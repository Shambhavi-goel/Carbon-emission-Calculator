# PostgreSQL Database Implementation Plan: Waste Carbon Calculator & Eco-Reward System

**Target Database:** PostgreSQL 14+  
**Target Directory:** `database/`  
**Purpose:** Replaces client-side `localStorage` with a robust, normalized, relational PostgreSQL backend store.

---

## 1. Requirements & Core Data Mapping

Based on the existing frontend client architecture ([`authService.js`](../frontend/js/authService.js), [`storageService.js`](../frontend/js/storageService.js), [`walletService.js`](../frontend/js/walletService.js)) and the specific business rules provided:

| Field / Requirement | Database Mapping | Specifications & Type |
| :--- | :--- | :--- |
| **User ID** | `users.id` | `UUID` (Primary Key, generated via `gen_random_uuid()`) |
| **Email ID** | `users.email` | `VARCHAR(255)` UNIQUE NOT NULL (stored in lowercase) |
| **Full Name** | `users.full_name` | `VARCHAR(120)` NOT NULL |
| **Password Hash & Salt** | `users.password_hash`, `users.salt` | `VARCHAR(255)` & `VARCHAR(64)` NOT NULL |
| **Coins in Wallet** | `wallets.coins` | `INTEGER` NOT NULL DEFAULT 0 (CHECK `>= 0`) |
| **Streaks** | `wallets.current_streak`, `wallets.last_active_date` | `INTEGER` NOT NULL DEFAULT 0, `DATE` for daily continuity |
| **History Records** | `emission_history` | Stores user's logs, input weight, grams, factor, and emission output |
| **Classification Values** | `waste_emission_factors` | Uses **Average Values** per waste class (ignoring ranges) |
| **Calculation Formula** | `emission_history.emission_output` | **$\text{emission\_output} = \text{avg\_emission\_factor} \times \text{weight\_in\_grams}$** (with automatic kg $\rightarrow$ g conversion) |

---

## 2. Waste Classification & Average Emission Factors

Each waste category uses its constant **Average Emission Factor** (stored in `waste_emission_factors`):

| Waste Class (`class_id`) | Emission Factor Range (Reference Only) | **Average Emission Factor Used** |
| :--- | :--- | :--- |
| `metal` | 0.93 – 3.8 | **`2.365000`** |
| `organic` | 0.24 – 0.32 | **`0.280000`** |
| `paper` | 0.49 – 2.5 | **`1.495000`** |
| `plastic_low` | 1.31 – 2.08 | **`1.695000`** |
| `plastic_mid` | 3.29 – 3.87 | **`3.580000`** |
| `plastic_high` | 5.66 – 5.7 | **`5.680000`** |
| `wood` | 0.263 – 0.49283 | **`0.377915`** |

### Output Calculation Logic:
1. User provides `weight_input` with unit `g` or `kg`.
2. Unit normalization:
   * If unit is `'kg'`, then: $\text{weight\_in\_grams} = \text{weight\_input} \times 1000$
   * If unit is `'g'`, then: $\text{weight\_in\_grams} = \text{weight\_input}$
3. Emission Output:
   $$\text{emission\_output} = \text{avg\_emission\_factor} \times \text{weight\_in\_grams}$$

*Example: 2 kg of `metal` $\rightarrow 2000 \text{ g} \times 2.365 = 4730.0$ emission output units.*

---

## 3. Database Architecture (ERD)

```
┌─────────────────────────────────────────────────────────────┐
│                          users                              │
├─────────────────────────────────────────────────────────────┤
│ id (PK, UUID)                                               │
│ email (UQ, VARCHAR)                                         │
│ full_name (VARCHAR)                                         │
│ password_hash (VARCHAR)                                     │
│ salt (VARCHAR)                                              │
│ created_at (TIMESTAMPTZ)                                    │
└──────────────┬──────────────────────────────┬───────────────┘
               │ 1:1                          │ 1:N
               ▼                              ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│           wallets            │ │      emission_history       │
├──────────────────────────────┤ ├─────────────────────────────┤
│ user_id (PK, FK -> users)    │ │ id (PK, UUID)               │
│ coins (INT >= 0)             │ │ user_id (FK -> users)       │
│ lifetime_earned (INT >= 0)   │ │ class_id (FK -> factors)    │
│ current_streak (INT >= 0)    │ │ weight_input (NUMERIC)      │
│ last_active_date (DATE)      │ │ input_unit ('g' / 'kg')     │
│ updated_at (TIMESTAMPTZ)     │ │ weight_grams (NUMERIC)      │
└──────────────┬───────────────┘ │ emission_factor (NUMERIC)   │
               │ 1:N             │ emission_output (NUMERIC)   │
               ▼                 │ points_earned (INT)         │
┌──────────────────────────────┐ │ thumbnail (TEXT)            │
│     wallet_transactions      │ │ created_at (TIMESTAMPTZ)    │
├──────────────────────────────┤ └──────────────┬──────────────┘
│ id (PK, UUID)                │                │
│ user_id (FK -> users)        │                │ N:1
│ calculation_id (FK -> history) │                ▼
│ coins_awarded (INT)          │ ┌─────────────────────────────┐
│ tx_type (VARCHAR)            │ │   waste_emission_factors    │
│ description (TEXT)           │ ├─────────────────────────────┤
│ breakdown (JSONB)            │ │ id (PK, VARCHAR)            │
│ created_at (TIMESTAMPTZ)     │ │ display_name (VARCHAR)      │
└──────────────────────────────┘ │ avg_emission_factor (NUMERIC)│
                                 └─────────────────────────────┘
```

---

## 4. Structure of the `database/` Folder

All database artifacts reside exclusively in the `database/` folder:

* [`database/schema.sql`](file:///d:/Carbon-emission-Calculator/database/schema.sql): Table definitions, constraints, indexes, and primary keys.
* [`database/seed.sql`](file:///d:/Carbon-emission-Calculator/database/seed.sql): Initial seeds for the 7 waste classes and their average emission factors.
* [`database/functions.sql`](file:///d:/Carbon-emission-Calculator/database/functions.sql):
  * `convert_to_grams(weight, unit)`: Automatic conversion from kg $\rightarrow$ g.
  * `record_emission_and_credit_wallet(...)`: ACID routine performing calculation ($\text{avg\_factor} \times \text{weight\_in\_grams}$), history insertion, streak updating, and coin crediting.
* [`database/queries.sql`](file:///d:/Carbon-emission-Calculator/database/queries.sql): Standard application queries (Auth lookups, Paginated History, Aggregated Dashboards, Wallet Ledger).
* [`database/.env.example`](file:///d:/Carbon-emission-Calculator/database/.env.example): Connection string template.
