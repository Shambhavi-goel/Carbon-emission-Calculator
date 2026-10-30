-- ─── 1. USER AUTHENTICATION & REGISTRATION ────────────────────────────

-- Register a new user and initialize an empty wallet
-- (Wrap in a transaction if executed manually)
WITH new_user AS (
    INSERT INTO users (email, full_name, password_hash, salt)
    VALUES (LOWER(TRIM($1)), $2, $3, $4)
    RETURNING id, email, full_name, created_at
),
new_wallet AS (
    INSERT INTO wallets (user_id, coins, lifetime_earned, current_streak)
    SELECT id, 0, 0, 0 FROM new_user
    RETURNING user_id, coins, current_streak
)
SELECT u.id, u.email, u.full_name, w.coins, w.current_streak, u.created_at
FROM new_user u
JOIN new_wallet w ON u.id = w.user_id;

-- Look up user for login by email
SELECT id, email, full_name, password_hash, salt, created_at
FROM users
WHERE LOWER(email) = LOWER(TRIM($1));

-- ─── 2. EMISSION HISTORY & ANALYTICS ──────────────────────────────────

-- Fetch user calculation history (with pagination)
SELECT 
    h.id,
    h.class_id,
    f.display_name AS class_label,
    h.weight_input,
    h.input_unit,
    h.weight_grams,
    h.emission_factor,
    h.emission_output,
    h.points_earned,
    h.thumbnail,
    h.created_at
FROM emission_history h
JOIN waste_emission_factors f ON h.class_id = f.id
WHERE h.user_id = $1
ORDER BY h.created_at DESC
LIMIT $2 OFFSET $3;

-- Get aggregate summary (Total emissions in grams, total items, most common material)
SELECT 
    COUNT(*)::INT AS total_analyses,
    COALESCE(SUM(h.emission_output), 0) AS total_emission_output,
    COALESCE(SUM(h.weight_grams), 0) AS total_weight_grams,
    (
        SELECT class_id 
        FROM emission_history 
        WHERE user_id = $1 
        GROUP BY class_id 
        ORDER BY COUNT(*) DESC 
        LIMIT 1
    ) AS most_frequent_class
FROM emission_history h
WHERE h.user_id = $1;

-- Emission output breakdown grouped by material class
SELECT 
    h.class_id,
    f.display_name,
    COUNT(*)::INT AS count,
    ROUND(SUM(h.emission_output), 4) AS class_emission_output,
    ROUND(SUM(h.weight_grams), 2) AS class_weight_grams
FROM emission_history h
JOIN waste_emission_factors f ON h.class_id = f.id
WHERE h.user_id = $1
GROUP BY h.class_id, f.display_name
ORDER BY class_emission_output DESC;

-- Delete a specific calculation from history
DELETE FROM emission_history
WHERE id = $1 AND user_id = $2;

-- ─── 3. WALLET & ECO-POINTS ───────────────────────────────────────────

-- Fetch user's current wallet state
SELECT 
    user_id,
    coins,
    lifetime_earned,
    current_streak,
    last_active_date,
    updated_at
FROM wallets
WHERE user_id = $1;

-- Fetch last 50 transactions for wallet modal
SELECT 
    id,
    calculation_id,
    coins_awarded,
    tx_type,
    description,
    breakdown,
    created_at
FROM wallet_transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
