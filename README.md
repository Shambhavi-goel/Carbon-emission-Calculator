# CarbonIQ — Waste Carbon Emission Calculator

**CarbonIQ** is an AI-powered ecological footprint tracker and waste classification platform. By uploading an image of household or commercial waste and entering an approximate weight, the platform automatically identifies the waste material using deep learning, computes the accurate greenhouse gas emissions ($kg\ CO_2e$), awards gamified **Eco-Points**, tracks daily consistency streaks, and records a permanent ledger in a PostgreSQL database.

---

## 🌟 Key Features

- **Automated AI Material Classification:** Upload a waste image to classify it into material categories (Metal, Organic, Paper, Low/Mid/High-Impact Plastics, Wood).
- **Accurate Carbon Calculations:** Calculates carbon emissions using standard $kg\ CO_2e/kg$ emission factors tailored to material types.
- **Gamified Rewards & Eco-Points:** Earn points for tracking waste, maintain daily activity streaks, and climb tiers.
- **Atomic Database Ledger:** Stored procedures in PostgreSQL atomically update wallet balances, calculate daily streaks, and log history in a single transaction.
- **Global Database-Backed Authentication:** User signups and logins are secured with SHA-256 and unique cryptographic salts stored in PostgreSQL.
- **Multi-Environment Architecture:** Seamlessly toggles between local development servers and cloud serverless deployment on Vercel with Neon PostgreSQL.

---

## 🛠️ Complete Technology Stack

### 1. Machine Learning & Computer Vision
* **Core Architecture:** MobileNetV2 Deep Convolutional Neural Network
* **Inference Engine:** **ONNX Runtime** (`onnxruntime>=1.17.0`) for fast CPU-optimized execution in serverless and containerized environments.
* **Image Processing:** **Pillow (PIL)** and **NumPy** for resizing to $224 \times 224 \times 3$, normalization, and thumbnail generation.
* **Supported Waste Categories:**
  - `metal` — Scrap metals, aluminum cans, foil, packaging
  - `organic` — Food scraps, compostable peelings
  - `paper` — Cardboard, mixed paper, newsprint
  - `plastic_low` — Low-density consumer plastics (LDPE/PP)
  - `plastic_mid` — Rigid consumer plastics (PET, HDPE bottles)
  - `plastic_high` — Dense, composite, or multi-layer polymers
  - `wood` — Timber, wooden scraps, packaging wood

### 2. Backend & API
* **Framework:** **FastAPI** (`fastapi>=0.110.0`)
* **ASGI Server:** **Uvicorn** (`uvicorn[standard]>=0.28.0`)
* **Configuration & Validation:** **Pydantic v2** & **Pydantic-Settings** for strict request body schemas and environment variable parsing.
* **CORS Handling:** `CORSMiddleware` configured to allow secure cross-origin requests across local ports and production domains.
* **REST Endpoints:**
  - `POST /api/analyze` — Multipart image upload + weight analysis, ONNX model inference, emission calculation, and atomic DB commit.
  - `POST /api/auth/signup` — Registers new user with cryptographic salt and SHA-256 password hash.
  - `POST /api/auth/login` (and `/signin`) — Authenticates credentials using `hmac.compare_digest` against database records.
  - `GET /api/auth/me` — Verifies active session token/UUID.
  - `GET /api` — Healthcheck and API version status.

### 3. Database
* **Database Engine:** **PostgreSQL 14+**
* **Database Driver:** **Psycopg 3** (`psycopg[binary]>=3.1.18`) with `dict_row` factory.
* **Cloud Database Provider:** **Neon Serverless PostgreSQL** (integrated via Vercel Storage).
* **Database Architecture & Schema:**
  - `users` — UUID primary keys (`gen_random_uuid()`), unique email index, salted password hashes.
  - `wallets` — 1:1 user wallet storing total coins, lifetime points, and active daily streak.
  - `waste_emission_factors` — Master table storing baseline emission factors ($kg\ CO_2e/kg$).
  - `emission_history` — Itemized log of analyzed waste items, weights, and computed emissions.
  - `wallet_transactions` — Append-only ledger recording point awards and calculation breakdowns.
  - **Stored Procedure:** `record_emission_and_credit_wallet(...)` ensures ACID guarantees during analysis and streak updates.

### 4. Frontend
* **Core:** Semantic **HTML5** with accessibility (ARIA live regions, accessible forms, skip-to-content).
* **Styling:** **Vanilla CSS3** structured using modular design tokens:
  - `tokens.css` — Palette variables, spacing scale, font definitions, and glassmorphic elevations.
  - `base.css` — Modern reset, typography, and foundational layout.
  - `components.css` — Cards, badges, buttons, modals, and toasts.
  - `sections.css` — Responsive grid dashboard, tables, and statistics.
* **Client Logic:** **Modern ES6+ JavaScript Modules**:
  - `authService.js` — Client-side session management with backend synchronization and fallback.
  - `analyzeService.js` — Multipart request builder with endpoint detection and fallback.
  - `dashboard.js` — Real-time emission calculations, material filter, history rendering, and wallet animations.

### 5. Deployment & Cloud Infrastructure
* **Hosting Platform:** **Vercel** (`vercel.json`)
  - Serverless Python functions (`@vercel/python`) routing `/api/(.*)` to `api/index.py`.
  - Static CDN distribution (`@vercel/static`) delivering all frontend assets with cache control.
* **Cloud Database:** **Neon.tech** connected via secure SSL connection string (`DATABASE_URL` / `POSTGRES_URL`).

---

## 📁 Project Directory Structure

```text
Carbon-emission-Calculator/
├── api/
│   └── index.py               # Vercel serverless entry point bridging to FastAPI
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── analyze.py     # Image analysis & emission calculation endpoint
│   │   │   └── auth.py        # Database signup & login endpoints
│   │   ├── config.py          # Pydantic environment settings
│   │   ├── database.py        # Psycopg3 connection manager
│   │   ├── main.py            # FastAPI initialization & CORS setup
│   │   ├── ml_service.py      # ONNX inference & preprocessing pipeline
│   │   └── reward_engine.py   # Eco-point & streak computation rules
│   ├── models/
│   │   ├── class_labels.json  # Classification index-to-category mapping
│   │   └── waste_model.onnx   # Optimized MobileNetV2 ONNX model
│   └── requirements.txt       # Backend Python dependencies
├── database/
│   ├── schema.sql             # Table schemas, indices, and constraints
│   ├── functions.sql          # Stored functions for atomic updates
│   ├── seed.sql               # Baseline emission factors
│   └── queries.sql            # Analytical queries for reporting
├── frontend/
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── sections.css
│   │   └── tokens.css
│   ├── js/
│   │   ├── analyzeService.js  # API client for waste analysis
│   │   ├── authService.js     # User authentication state & API client
│   │   ├── authUI.js          # Login & signup modal interactions
│   │   ├── config.js          # Frontend configuration (endpoints & timeouts)
│   │   ├── dashboard.js       # Main dashboard application logic
│   │   ├── factors.js         # Client emission constants
│   │   ├── main.js            # Landing page controller
│   │   ├── storageService.js  # Local history caching
│   │   ├── upload.js          # Drag-and-drop & image preview handling
│   │   └── walletService.js   # Eco-points & wallet state
│   ├── index.html             # Landing & authentication page
│   └── dashboard.html         # User dashboard & calculation workspace
├── vercel.json                # Vercel cloud deployment specification
├── requirements.txt           # Root dependencies for cloud builds
└── README.md
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Python 3.10+**
- **PostgreSQL 14+** (Local installation or free cloud instance from Neon.tech)

### 1. Clone the Repository
```bash
git clone https://github.com/Shambhavi-goel/Carbon-emission-Calculator.git
cd Carbon-emission-Calculator
```

### 2. Set Up the Python Virtual Environment
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Initialize the Database
If running locally, create a PostgreSQL database named `carbon_emission_db` and execute the SQL scripts in order:
```bash
psql -U postgres -d carbon_emission_db -f database/schema.sql
psql -U postgres -d carbon_emission_db -f database/functions.sql
psql -U postgres -d carbon_emission_db -f database/seed.sql
```

Create a `.env` file inside `backend/`:
```env
HOST=127.0.0.1
PORT=8000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/carbon_emission_db
```

### 4. Run the Backend Server
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
The interactive Swagger API documentation will be available at `http://127.0.0.1:8000/docs`.

### 5. Run the Frontend
In a separate terminal, serve the `frontend/` directory:
```bash
# From the project root:
python -m http.server 5500 --directory frontend
```
Open **`http://localhost:5500`** in your browser.

---

## ☁️ Deployment on Vercel

1. **Push your code to GitHub:**
   ```bash
   git push origin main
   ```
2. **Import into Vercel:**
   - Link your GitHub repository in the Vercel dashboard.
   - Vercel will automatically detect `vercel.json` and configure `@vercel/python` for the API and `@vercel/static` for the frontend.
3. **Attach a Database:**
   - Under the **Storage** tab in your Vercel project, attach a **Neon Serverless Postgres** database (or add a `DATABASE_URL` environment variable from Neon.tech).
4. **Deploy:**
   - Vercel will build and launch your application globally with serverless compute.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
