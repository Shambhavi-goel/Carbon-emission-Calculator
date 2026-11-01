import hashlib
import hmac
import secrets
import re
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.database import get_connection

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(bytes.fromhex(salt) + password.encode("utf-8")).hexdigest()

class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str

class SignInRequest(BaseModel):
    email: str
    password: str

@router.post("/signup")
def signup(payload: SignUpRequest):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name cannot be empty.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")

    email_clean = payload.email.strip().lower()
    if not EMAIL_REGEX.match(email_clean):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter a valid email address.")
    salt = secrets.token_hex(16)
    pw_hash = hash_password(payload.password, salt)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE LOWER(email) = %s;", (email_clean,))
                if cur.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="An account with this email already exists. Sign in instead."
                    )

                cur.execute("""
                    INSERT INTO users (email, full_name, password_hash, salt)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, email, full_name;
                """, (email_clean, name, pw_hash, salt))
                new_user = cur.fetchone()

                cur.execute("""
                    INSERT INTO wallets (user_id)
                    VALUES (%s)
                    ON CONFLICT (user_id) DO NOTHING;
                """, (new_user["id"],))
                conn.commit()

        return {
            "success": True,
            "user": {
                "id": str(new_user["id"]),
                "name": new_user["full_name"],
                "email": new_user["email"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

@router.post("/login")
@router.post("/signin")
def signin(payload: SignInRequest):
    email_clean = payload.email.strip().lower()

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, full_name, password_hash, salt
                    FROM users
                    WHERE LOWER(email) = %s;
                """, (email_clean,))
                user = cur.fetchone()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email or password is incorrect."
            )

        computed = hash_password(payload.password, user["salt"])
        if not hmac.compare_digest(computed, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email or password is incorrect."
            )

        return {
            "success": True,
            "user": {
                "id": str(user["id"]),
                "name": user["full_name"],
                "email": user["email"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

@router.get("/me")
def get_current_user(user_id: str):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, email, full_name
                    FROM users
                    WHERE id = %s::uuid;
                """, (user_id,))
                user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return {
            "success": True,
            "user": {
                "id": str(user["id"]),
                "name": user["full_name"],
                "email": user["email"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")
