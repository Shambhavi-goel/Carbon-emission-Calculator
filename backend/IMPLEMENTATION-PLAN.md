# Backend Implementation Plan: AI Image Classification & Waste Emission API

**Branch:** `backend`  
**Target Directory:** `backend/`  
**Runtime:** Python 3.10+ / FastAPI  
**Database:** PostgreSQL (`carbon_emission_db`) via `psycopg` / `asyncpg`

---

## 1. System Overview & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Frontend Client (dashboard.html, upload.js, analyzeService.js)           │
│    • User drops an image + enters weight (grams or kilograms)               │
│    • Sends POST to /api/analyze as multipart/form-data:                     │
│      - image (file: JPG/PNG/WebP)                                           │
│      - weight (number, e.g. 2.5)                                            │
│      - unit ('kg' or 'g')                                                   │
│      - userId (UUID of authenticated user)                                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP POST /api/analyze
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. FastAPI Backend Server (backend/app/main.py)                             │
│    ├── A. ml_service.py (AI Classification Engine)                          │
│    │   • Preprocesses uploaded image (resize, normalize, tensor)            │
│    │   • Executes model inference (.predict / model(x))                     │
│    │   • Predicts class from the 7 waste categories:                        │
│    │     [metal, organic, paper, plastic_low, plastic_mid, plastic_high, wood│
│    │   • Computes classification confidence (0.0 to 1.0)                    │
│    │                                                                        │
│    ├── B. Reward Engine (coins calculation)                                 │
│    │   • Calculates eco-coins based on weight and bonus thresholds          │
│    │                                                                        │
│    └── C. PostgreSQL Database Integration (database.py)                     │
│        • Calls record_emission_and_credit_wallet(...)                        │
│        • Auto-converts weight to grams (if 'kg' -> weight * 1000)           │
│        • emission_output = avg_emission_factor * weight_in_grams            │
│        • Persists history, streaks, and wallet ledger atomically            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ JSON Response
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Frontend Result Display & Dashboard Update                               │
│    • Receives: { material, confidence, weightGrams, emissionOutput, coins } │
│    • Shows classification card, emission breakdown, and reward animation    │
│    • Automatically refreshes wallet balance, streak, and history table      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Layout (`backend/`)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app initialization, CORS middleware, route registration
│   ├── config.py            # Pydantic settings loading from .env (DB credentials, model path)
│   ├── database.py          # PostgreSQL connection pool and query helpers
│   ├── ml_service.py        # Image preprocessor, model loader, and inference logic
│   ├── reward_engine.py     # Python port of frontend reward/eco-points formula
│   └── routes/
│       ├── __init__.py
│       ├── analyze.py       # POST /api/analyze (Image -> Model -> Calc -> DB)
│       ├── auth.py          # POST /api/auth/signup & POST /api/auth/signin
│       ├── emissions.py     # GET /api/emissions, GET /api/emissions/summary, DELETE /:id
│       └── wallet.py        # GET /api/wallet (Balance, streak, transaction ledger)
├── models/                  # Storage directory for the exported Colab AI model
│   ├── waste_model.*        # Downloaded trained model (.keras, .pth, .onnx, or .pt)
│   └── class_labels.json    # Mapping of index 0..6 to the 7 database classes
├── requirements.txt         # Dependencies (fastapi, uvicorn, psycopg, pillow, etc.)
├── .env.example             # Configuration template
└── README.md                # Quickstart instructions to run the backend
```

---

## 3. Waste Class Mapping (`class_labels.json`)

Maps your Colab model's output index to the exact primary keys in `waste_emission_factors`:

```json
{
  "0": "metal",
  "1": "organic",
  "2": "paper",
  "3": "plastic_low",
  "4": "plastic_mid",
  "5": "plastic_high",
  "6": "wood"
}
```

The database applies the average emission factors to the weight in grams:
* `metal`: **`2.365000`**
* `organic`: **`0.280000`**
* `paper`: **`1.495000`**
* `plastic_low`: **`1.695000`**
* `plastic_mid`: **`3.580000`**
* `plastic_high`: **`5.680000`**
* `wood`: **`0.377915`**

---

## 4. API Endpoints Specification

### 4.1 Image Analysis & Emission Logging (`POST /api/analyze`)
* **Request (`multipart/form-data`):**
  * `image`: File (image bytes)
  * `weight`: Float (e.g. `2.5`)
  * `unit`: String (`'kg'` or `'g'`)
  * `user_id`: UUID (optional in demo mode, required when logged in)
* **Processing Steps:**
  1. Open image in memory using Pillow (`PIL.Image`).
  2. Generate a compressed base64 thumbnail for history display.
  3. Preprocess image into tensor according to Colab training specifications (e.g. $224 \times 224$, normalize).
  4. Run model inference $\rightarrow$ get `class_id` and `confidence`.
  5. Compute points to award (`reward_engine.py`).
  6. Execute `record_emission_and_credit_wallet(...)` in PostgreSQL.
* **Response (`application/json`):**
  ```json
  {
    "success": true,
    "historyId": "56815e20-8926-4972-9910-5b9fd2abd7ff",
    "material": "metal",
    "confidence": 0.942,
    "weightInput": 2.5,
    "inputUnit": "kg",
    "weightGrams": 2500.0,
    "emissionFactor": 2.365,
    "emissionOutput": 5912.5,
    "coinsAwarded": 40,
    "walletCoins": 80,
    "currentStreak": 1
  }
  ```

### 4.2 Authentication Endpoints
* `POST /api/auth/signup`:
  * Body: `{ email, fullName, password }`
  * Action: Hashes password, creates `users` record + initial `wallets` record.
* `POST /api/auth/signin`:
  * Body: `{ email, password }`
  * Action: Verifies hash, returns user profile + session token (or user ID).

### 4.3 History & Analytics Endpoints
* `GET /api/emissions?user_id=<UUID>&page=1&limit=20`:
  * Returns user's history list with thumbnails, grams, factors, and emission outputs.
* `GET /api/emissions/summary?user_id=<UUID>`:
  * Returns total emissions, total item count, and category breakdown.
* `DELETE /api/emissions/{id}?user_id=<UUID>`:
  * Deletes a specific history item.

### 4.4 Wallet & Streak Endpoints
* `GET /api/wallet?user_id=<UUID>`:
  * Returns current coins balance, streak, lifetime earned, and the 50 most recent transactions.

---

## 5. Phased Implementation Steps

### Phase 1: Environment & Base Server Setup
1. Create `backend/requirements.txt` with FastAPI, Uvicorn, Psycopg, Pillow, Pydantic, etc.
2. Create `backend/app/config.py` and `backend/.env.example` to read DB credentials.
3. Create `backend/app/database.py` with a connection pool to `carbon_emission_db`.
4. Create `backend/app/main.py` with CORS middleware (allowing requests from `http://localhost:5500` and `http://127.0.0.1:5500`).

### Phase 2: AI Model Integration Module (`ml_service.py`)
1. Create `backend/models/` and `class_labels.json`.
2. Implement `WasteClassifier` class in `ml_service.py`:
   * Graceful fallback: If model file is not yet downloaded, returns a mock classification so the entire API pipeline is immediately testable.
   * Dynamic loader: Detects `.keras`, `.h5`, `.pth`, or `.onnx` and runs real inference once placed into `backend/models/`.

### Phase 3: Route Handlers Implementation
1. `backend/app/routes/analyze.py`: Connects Image Upload $\rightarrow$ `ml_service` $\rightarrow$ DB stored procedure.
2. `backend/app/routes/auth.py`, `emissions.py`, `wallet.py`.

### Phase 4: Frontend Integration & Testing
1. Configure `API_BASE_URL = "http://localhost:8000"` and `USE_MOCK = false` in `frontend/js/config.js`.
2. Verify live upload in browser: upload an image $\rightarrow$ inspect predicted class, calculated emission in grams, and coins update.
