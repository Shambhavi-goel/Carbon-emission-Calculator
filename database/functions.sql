-- ─── Calculation & Unit Conversion Helper ─────────────────────────────
-- Converts input weight into grams:
-- If 'kg', weight_in_grams = weight_input * 1000
-- If 'g',  weight_in_grams = weight_input
CREATE OR REPLACE FUNCTION convert_to_grams(
    p_weight NUMERIC,
    p_unit VARCHAR(8)
)
RETURNS NUMERIC AS $$
BEGIN
    IF LOWER(TRIM(p_unit)) = 'kg' THEN
        RETURN p_weight * 1000.0;
    ELSIF LOWER(TRIM(p_unit)) = 'g' THEN
        RETURN p_weight;
    ELSE
        RAISE EXCEPTION 'Invalid weight unit: %. Expected ''g'' or ''kg''.', p_unit;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── Atomic Emission Calculation & Wallet Crediting Routine ───────────
DROP FUNCTION IF EXISTS record_emission_and_credit_wallet(UUID, VARCHAR, NUMERIC, VARCHAR, INT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION record_emission_and_credit_wallet(
    p_user_id UUID,
    p_class_id VARCHAR(32),
    p_weight_input NUMERIC,
    p_unit VARCHAR(8),
    p_coins_awarded INT,
    p_thumbnail TEXT DEFAULT NULL,
    p_description TEXT DEFAULT 'Waste classification analysis',
    p_breakdown JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
    history_id UUID,
    class_id VARCHAR(32),
    weight_input NUMERIC,
    input_unit VARCHAR(8),
    weight_in_grams NUMERIC,
    avg_factor NUMERIC,
    calculated_emission_output NUMERIC,
    coins_awarded INT,
    wallet_coins INT,
    streak_count INT
) AS $$
#variable_conflict use_column
DECLARE
    v_factor NUMERIC(10, 6);
    v_grams NUMERIC(12, 4);
    v_output NUMERIC(16, 6);
    v_hist_id UUID;
    v_today DATE := CURRENT_DATE;
    v_last_active DATE;
    v_streak INT;
    v_new_streak INT;
    v_new_coins INT;
BEGIN
    -- 1. Fetch exact average emission factor for the waste class
    SELECT f.avg_emission_factor INTO v_factor
    FROM waste_emission_factors f
    WHERE f.id = p_class_id;

    IF v_factor IS NULL THEN
        RAISE EXCEPTION 'Invalid waste class: %. Please select a valid category.', p_class_id;
    END IF;

    -- 2. Convert input weight to grams
    v_grams := convert_to_grams(p_weight_input, p_unit);

    -- 3. Calculate output: avg_emission_factor * weight_grams
    v_output := ROUND(v_factor * v_grams, 6);

    -- 4. Record emission history entry
    INSERT INTO emission_history (
        user_id,
        class_id,
        weight_input,
        input_unit,
        weight_grams,
        emission_factor,
        emission_output,
        points_earned,
        thumbnail
    ) VALUES (
        p_user_id,
        p_class_id,
        p_weight_input,
        LOWER(TRIM(p_unit)),
        v_grams,
        v_factor,
        v_output,
        p_coins_awarded,
        p_thumbnail
    ) RETURNING id INTO v_hist_id;

    -- 5. Lock and retrieve user wallet for streak and balance calculation
    SELECT w.last_active_date, w.current_streak
    INTO v_last_active, v_streak
    FROM wallets w
    WHERE w.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    -- 6. Evaluate daily streak
    IF v_last_active IS NULL OR v_last_active < (v_today - INTERVAL '1 day') THEN
        v_new_streak := 1;
    ELSIF v_last_active = (v_today - INTERVAL '1 day') THEN
        v_new_streak := v_streak + 1;
    ELSE
        -- Same day activity maintains streak
        v_new_streak := v_streak;
    END IF;

    -- 7. Update wallet coins and streak
    UPDATE wallets
    SET coins = coins + p_coins_awarded,
        lifetime_earned = lifetime_earned + p_coins_awarded,
        current_streak = v_new_streak,
        last_active_date = v_today,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id
    RETURNING coins INTO v_new_coins;

    -- 8. Record wallet transaction log
    INSERT INTO wallet_transactions (
        user_id,
        calculation_id,
        coins_awarded,
        tx_type,
        description,
        breakdown
    ) VALUES (
        p_user_id,
        v_hist_id,
        p_coins_awarded,
        'earn_analysis',
        p_description,
        p_breakdown
    );

    -- 9. Return structured output
    RETURN QUERY SELECT 
        v_hist_id,
        p_class_id,
        p_weight_input,
        LOWER(TRIM(p_unit))::VARCHAR(8),
        v_grams,
        v_factor,
        v_output,
        p_coins_awarded,
        v_new_coins,
        v_new_streak;
END;
$$ LANGUAGE plpgsql;
