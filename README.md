# SpaceSync

SpaceSync is a FastAPI + HTML/CSS/JS booking platform for cricket grounds, party halls, parking, owner listings, bookings, reviews, analytics, notifications, and ML-assisted availability.

This repo is now prepared for a fully free, no-card deployment path:

- Render for the backend
- Render Static Site for the frontend
- Neon for PostgreSQL
- Cloudinary for listing image uploads

That stack fits this codebase well because the app already uses FastAPI, SQLAlchemy, relational data, and owner image uploads.

## Why this deployment path

This project should not be moved to Firestore or a backendless setup unless you want a rewrite.

The current code expects:

- a Python backend
- a relational SQL database
- server-side auth and business logic
- persistent image storage

So the cleanest free setup is:

1. Render Web Service for FastAPI
2. Neon Postgres for the database
3. Cloudinary Free plan for image hosting
4. Render Static Site for the frontend

## What changed in the code

The deployment-related code now supports:

1. Hosted Postgres via `DATABASE_URL`
2. SSL database connections for hosted Postgres
3. Runtime-configurable frontend API base via `frontend/js/runtime-config.js`
4. Cloudinary uploads for owner listing photos
5. Render deployment through `render.yaml`
6. Local fallback uploads when no cloud storage is configured

## Key files

Backend:

- `backend/database.py`
- `backend/routes/spaces.py`
- `backend/services/storage.py`
- `backend/requirements.txt`

Frontend:

- `frontend/js/main.js`
- `frontend/js/detail.js`
- `frontend/js/runtime-config.js`

Deployment:

- `.env.example`
- `render.yaml`
- `Dockerfile`
- `.dockerignore`

## Environment variables

Use `.env.example` as the template.

Typical production values:

```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require
DB_SSLMODE=require
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_RECYCLE=1800

SECRET_KEY=replace_this_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

Notes:

- `DATABASE_URL` comes from Neon
- `CLOUDINARY_*` comes from Cloudinary
- `SECRET_KEY` must be a real secret in production
- `DB_SSLMODE=require` is recommended for hosted Postgres

## Local development

### 1. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Create `.env`

```bash
copy .env.example .env
```

### 3. Run backend

From project root:

```bash
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### 4. Run frontend

```bash
cd frontend
python -m http.server 3001
```

### 5. Open app

- Frontend: `http://127.0.0.1:3001`
- Backend docs: `http://127.0.0.1:8001/docs`

## Full free deployment guide

## Part 1: Create a Neon database

Neon is a hosted Postgres provider and its pricing page says the Free plan is `$0` and is available with no credit card required.

### Steps

1. Go to Neon and create an account.
2. Create a new project.
3. Choose PostgreSQL.
4. Open your project dashboard.
5. Copy the connection string.

It will look similar to:

```env
postgresql://neondb_owner:YOUR_PASSWORD@ep-xxxx-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

Put that into:

```env
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-xxxx-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DB_SSLMODE=require
```

## Part 2: Create a Cloudinary account

Cloudinary Free is the best fit here for listing image uploads.

### Steps

1. Create a Cloudinary account.
2. Open the product dashboard.
3. Copy:
   - Cloud name
   - API key
   - API secret

Put them into env:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

The backend will automatically use Cloudinary first when these values are present.

## Part 3: Prepare the backend for Render

The repo already includes:

- `render.yaml`
- `Dockerfile`

You can deploy from the Render dashboard or from the repo blueprint.

### Backend env vars needed on Render

Set these in your Render backend service:

- `DATABASE_URL`
- `DB_SSLMODE=require`
- `SECRET_KEY`
- `ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=30`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

## Part 4: Deploy the backend to Render

Render's getting-started docs say their free deploy flow uses free resources and no payment is required.

### Steps

1. Push this repo to GitHub.
2. Sign in to Render.
3. Click `New`.
4. Choose `Web Service`.
5. Connect your GitHub repo.
6. Select this project.
7. Use these settings:

- Name: `spacesync-api`
- Runtime: `Python 3`
- Root directory: leave blank if deploying from repo root
- Build command:

```bash
pip install -r backend/requirements.txt && python -m backend.ml.train_surge_pricing && python -m backend.ml.train_recommendations && python -m backend.ml.train_availability
```

- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

8. Add the env vars listed above.
9. Deploy the service.

After deployment, Render will give you a backend URL like:

```text
https://spacesync-api.onrender.com
```

Keep that URL.

## Part 5: Point the frontend to the deployed backend

Before deploying the frontend, edit:

- `frontend/js/runtime-config.js`

Change it from:

```js
window.__API_BASE__ = window.__API_BASE__ || "http://localhost:8001";
```

to:

```js
window.__API_BASE__ = "https://spacesync-api.onrender.com";
```

Use your real backend URL.

This is required because:

- all frontend `fetch()` calls use it
- WebSocket URLs are built from it too

## Part 6: Deploy the frontend for free

### Option A: Render Static Site

This is the simplest because both frontend and backend stay on Render.

Steps:

1. In Render, click `New`.
2. Choose `Static Site`.
3. Connect the same GitHub repo.
4. Use these settings:

- Name: `spacesync-frontend`
- Root directory: `frontend`
- Build command: leave empty
- Publish directory: `.`

5. Deploy.

Your frontend URL will look like:

```text
https://spacesync-frontend.onrender.com
```

### Option B: Vercel or Netlify

You can also host the `frontend/` folder on Vercel or Netlify if you prefer those interfaces.

If you do that, keep `runtime-config.js` pointing to your Render backend URL.

## Part 7: First production checks

After both deployments:

1. Open the frontend URL.
2. Register a normal user.
3. Login as the normal user.
4. Register an owner.
5. Login as the owner.
6. Create a listing.
7. Upload a listing photo.
8. Open the listing as a user.
9. Create a booking.
10. Add a review.

## How image upload works now

The backend storage order is now:

1. Cloudinary, if `CLOUDINARY_*` env vars are present
2. Firebase/Google bucket, if configured
3. Supabase Storage, if configured
4. local `/uploads` fallback

For production on free hosting, Cloudinary is the recommended path.

## How to update after deployment

Yes, you can keep changing the code after deployment.

### If you change backend code

Push to GitHub again.
Render will redeploy the backend service.

### If you change frontend code

Push to GitHub again.
Render Static Site will redeploy the frontend.

### If you change both

Push both changes.
Both services will redeploy.

### If you change database models

You may need to restart the backend and verify the tables/columns are created correctly in Neon.

## Troubleshooting

### Frontend still calls localhost

Check:

- `frontend/js/runtime-config.js`

It must contain your real deployed backend URL before frontend deployment.

### Owner image upload fails

Check:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

If these are missing, upload falls back away from Cloudinary.

### Backend cannot connect to database

Check:

- `DATABASE_URL`
- Neon password
- host name
- SSL mode

### Render backend builds but app does not start

Check:

- build logs
- start logs
- env vars
- whether `uvicorn main:app --host 0.0.0.0 --port $PORT` is exactly set

## Quick command summary

### Local backend

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### Local frontend

```bash
cd frontend
python -m http.server 3001
```

## Official references

- Render docs: [https://render.com/docs/your-first-deploy](https://render.com/docs/your-first-deploy)
- Neon pricing: [https://neon.com/pricing](https://neon.com/pricing)
- Cloudinary free plan: [https://cloudinary.com/documentation/developer_onboarding_faq_free_plan](https://cloudinary.com/documentation/developer_onboarding_faq_free_plan)

## Best free stack for this project

If you want everything free and no card for now, use:

- Backend: Render Web Service
- Frontend: Render Static Site
- Database: Neon Free
- Images: Cloudinary Free

That is the most practical deployment path for this current codebase without rewriting it.
