"""
Calculates eco-points matching frontend/js/rewardService.js rules.
"""

MATERIAL_RATES = {
    "metal": 30,
    "organic": 12,
    "paper": 15,
    "plastic_low": 20,
    "plastic_mid": 25,
    "plastic_high": 30,
    "wood": 10
}

BASE_POINTS = 10
DAILY_FIRST_BONUS = 15
HIGH_CONF_BONUS = 5
HIGH_CONF_THRESHOLD = 0.75

def calculate_reward_coins(material: str, weight_kg: float, confidence: float = 0.0) -> tuple[int, list[str]]:
    rate = MATERIAL_RATES.get(material, 10)
    material_points = int(round(weight_kg * rate))

    breakdown = [f"+{BASE_POINTS} base"]
    breakdown.append(f"+{material_points} ({weight_kg:.2f} kg × {rate} pts/kg – {material})")

    bonus_points = 0
    if confidence >= HIGH_CONF_THRESHOLD:
        bonus_points += HIGH_CONF_BONUS
        breakdown.append(f"+{HIGH_CONF_BONUS} high-confidence bonus")

    total_coins = min(BASE_POINTS + material_points + bonus_points, 200)
    return total_coins, breakdown
