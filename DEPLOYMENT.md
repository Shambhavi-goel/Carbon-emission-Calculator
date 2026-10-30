# Railway & Vercel Deployment Guide

Deploying your project across Railway (PostgreSQL + FastAPI AI Backend) and Vercel (Frontend):

```
┌────────────────────────────────────────────────────────┐
│               1. Vercel (Frontend Web)                 │
│         https://your-frontend.vercel.app               │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / API
                            ▼
┌────────────────────────────────────────────────────────┐
│            2. Railway (FastAPI + AI Model)             │
│        https://your-backend.up.railway.app             │
└───────────────────────────┬────────────────────────────┘
                            │ Private Database Connection
                            ▼
┌────────────────────────────────────────────────────────┐
│             3. Railway (PostgreSQL Database)           │
│                    Port 5432 (Internal)                │
└────────────────────────────────────────────────────────┘
```

---

## Part 1: Deploy Database on Railway

1. Sign up/log in at [railway.app](https://railway.app) using your GitHub account.
2. Click **Create a New Project** (or **New Project**).
3. Select **Provision PostgreSQL**.
4. Railway will create your database in a few seconds. Click on the PostgreSQL card.
5. Go to the **Data** tab (or **Query** tab) to run your SQL setup:
   - Run the contents of [`database/schema.sql`](./database/schema.sql)
   - Run the contents of [`database/seed.sql`](./database/seed.sql)
   - Run the contents of [`database/functions.sql`](./database/functions.sql)
6. Go to the **Variables** tab of your PostgreSQL service:
   - Notice the variable `DATABASE_URL` (Railway sets this automatically).

---

## Part 2: Deploy Backend & AI Model on Railway

1. In the same Railway project canvas, click **+ New** (top right) $\rightarrow$ **GitHub Repo**.
2. Select your repository: `Carbon-emission-Calculator`.
3. Click on the newly created service card $\rightarrow$ go to **Settings**:
   - Under **General**:
     - **Service Name**: `carbon-backend`
     - **Root Directory**: set to `/backend`
4. Go to the **Variables** tab of your backend service:
   - Click **+ New Variable** $\rightarrow$ Click **Add Reference**.
   - Select `Postgres` $\rightarrow$ `DATABASE_URL`.
   - Railway will link `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
5. Go to the **Networking** tab:
   - Under **Public Networking**, click **Generate Domain**.
   - Railway will provide your live URL (e.g. `https://carbon-backend-production-xyz.up.railway.app`).
6. Test your live backend by opening `https://<your-railway-url>/docs` in your browser!

---

## Part 3: Deploy Frontend on Vercel

1. Open [`frontend/js/config.js`](./frontend/js/config.js) locally:
   - Set `API_BASE_URL` to your Railway domain from Part 2:
     ```javascript
     export const API_BASE_URL = "https://your-backend-production-xyz.up.railway.app";
     export const USE_MOCK = false;
     ```
2. Commit and push this change to GitHub:
   ```bash
   git add .
   git commit -m "chore: connect frontend to Railway backend"
   git push origin main
   ```
3. Go to [vercel.com](https://vercel.com) and log in with GitHub.
4. Click **Add New...** $\rightarrow$ **Project**.
5. Import `Carbon-emission-Calculator`.
6. Under **Root Directory**, click **Edit** and choose `frontend`.
7. Click **Deploy**.
8. Vercel will give you a public URL (e.g. `https://carbon-emission-calculator.vercel.app`).
