import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.ml_service import classify_waste_image
from app.reward_engine import calculate_reward_coins
from app.database import get_connection

router = APIRouter(prefix="/api", tags=["Analysis & Emission"])

@router.post("/analyze")
async def analyze_waste(
    image: UploadFile = File(...),
    weight: float = Form(...),
    unit: str = Form("kg"),
    user_id: str = Form(None)
):
    if weight <= 0:
        raise HTTPException(status_code=400, detail="Weight must be greater than zero.")

    unit_clean = unit.strip().lower()
    if unit_clean not in ["g", "kg"]:
        raise HTTPException(status_code=400, detail="Unit must be 'g' or 'kg'.")

    # 1. Read image contents & classify via TensorFlow/Keras
    image_bytes = await image.read()
    class_id, confidence, thumbnail = classify_waste_image(image_bytes, image.filename)

    # 2. Convert to kg for reward points computation
    weight_kg = weight if unit_clean == "kg" else weight / 1000.0
    coins_awarded, breakdown = calculate_reward_coins(class_id, weight_kg, confidence)

    # 3. If no valid UUID is passed (or default swagger placeholder 'string'), use demo user
    import uuid
    valid_user_uuid = None
    if user_id and user_id.strip() and user_id.strip() != "string":
        try:
            valid_user_uuid = str(uuid.UUID(user_id.strip()))
        except ValueError:
            valid_user_uuid = None

    with get_connection() as conn:
        with conn.cursor() as cur:
            target_user_id = valid_user_uuid
            if not target_user_id:
                cur.execute("SELECT id FROM users WHERE email = 'demo@example.com';")
                demo_user = cur.fetchone()
                if not demo_user:
                    cur.execute("""
                        WITH new_user AS (
                            INSERT INTO users (email, full_name, password_hash, salt)
                            VALUES ('demo@example.com', 'Demo User', 'demohash', 'demosalt')
                            RETURNING id
                        )
                        INSERT INTO wallets (user_id) SELECT id FROM new_user RETURNING user_id;
                    """)
                    demo_user = cur.fetchone()
                target_user_id = str(demo_user["user_id"] if "user_id" in demo_user else demo_user["id"])

            # 4. Execute atomic stored procedure (record emission + update streak + credit wallet)
            cur.execute("""
                SELECT * FROM record_emission_and_credit_wallet(
                    %s::uuid,
                    %s::varchar,
                    %s::numeric,
                    %s::varchar,
                    %s::int,
                    %s::text,
                    %s::text,
                    %s::jsonb
                );
            """, (
                target_user_id,
                class_id,
                weight,
                unit_clean,
                coins_awarded,
                thumbnail,
                f"Classified as {class_id} ({weight} {unit_clean})",
                json.dumps(breakdown)
            ))
            result = cur.fetchone()
            conn.commit()

    return {
        "success": True,
        "historyId": str(result["history_id"]),
        "material": result["class_id"],
        "confidence": confidence,
        "weightInput": float(result["weight_input"]),
        "inputUnit": result["input_unit"],
        "weightGrams": float(result["weight_in_grams"]),
        "emissionFactor": float(result["avg_factor"]),
        "emissionOutput": float(result["calculated_emission_output"]),
        "coinsAwarded": int(result["coins_awarded"]),
        "walletCoins": int(result["wallet_coins"]),
        "currentStreak": int(result["streak_count"]),
        "thumbnail": thumbnail,
        "breakdown": breakdown
    }
