-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Waste Emission Factors Table (Exact average values per reference)
CREATE TABLE waste_emission_factors (
    id VARCHAR(32) PRIMARY KEY, -- 'metal', 'organic', 'paper', 'plastic_low', 'plastic_mid', 'plastic_high', 'wood'
    display_name VARCHAR(64) NOT NULL,
    avg_emission_factor NUMERIC(10, 6) NOT NULL, -- Factor used for multiplication
    description TEXT
);

-- 2. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE INDEX idx_users_email ON users (LOWER(email));

-- 3. Wallets Table (1:1 with users)
CREATE TABLE wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0),
    lifetime_earned INT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    last_active_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Emission History Table
-- Formula: emission_output = avg_emission_factor * weight_grams
CREATE TABLE emission_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id VARCHAR(32) NOT NULL REFERENCES waste_emission_factors(id),
    weight_input NUMERIC(10, 4) NOT NULL CHECK (weight_input > 0),
    input_unit VARCHAR(8) NOT NULL CHECK (input_unit IN ('g', 'kg')),
    weight_grams NUMERIC(12, 4) NOT NULL CHECK (weight_grams > 0),
    emission_factor NUMERIC(10, 6) NOT NULL, -- Snapshot of avg_emission_factor
    emission_output NUMERIC(16, 6) NOT NULL, -- emission_factor * weight_grams
    points_earned INT NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
    thumbnail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_user_date ON emission_history (user_id, created_at DESC);
CREATE INDEX idx_history_class ON emission_history (class_id);

-- 5. Wallet Transactions Ledger
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calculation_id UUID REFERENCES emission_history(id) ON DELETE SET NULL,
    coins_awarded INT NOT NULL,
    tx_type VARCHAR(32) NOT NULL, -- 'earn_analysis', 'daily_bonus', etc.
    description TEXT NOT NULL,
    breakdown JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_tx_user ON wallet_transactions (user_id, created_at DESC);
