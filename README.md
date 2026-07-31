# SpaceSync

SpaceSync is a space-booking platform for cricket grounds, party halls, parking spaces, and other bookable venues. It supports user bookings, owner-managed listings, reviews, slot blocking, analytics, notifications, listing photos, and ML-assisted pricing/recommendations.

The project uses a FastAPI backend with a simple HTML/CSS/JavaScript frontend. It can run locally with SQLite, and it is prepared for a free deployment setup using Render, Firebase Hosting, Neon Postgres, and Cloudinary.

## Features

- User and owner authentication with JWT
- Role-based access for users and space owners
- Browse and search available spaces
- Owner listing management with timings, contact details, photos, and map location
- Booking flow with availability checks
- Manual slot blocking and unblocking for owners
- Reviews with owner replies
- Owner notifications
- Owner earnings and analytics pages
- CSV booking export
- ML endpoints for surge pricing, recommendations, and availability

## Tech Stack

Backend:

- FastAPI
- SQLAlchemy
- SQLite for local development
- PostgreSQL for production
- Pydantic
- JWT authentication
- scikit-learn based ML helpers

Frontend:

- HTML
- CSS
- Vanilla JavaScript
- Chart.js
- Leaflet/OpenStreetMap

Deployment:

- Render for the backend API
- Firebase Hosting for the frontend
- Neon for PostgreSQL
- Cloudinary for listing image uploads

## Project Structure

```text
spacesync/
|-- backend/
|   |-- routes/
|   |-- services/
|   |-- ml/
|   |-- database.py
|   |-- models.py
|   |-- schemas.py
|   `-- requirements.txt
|-- frontend/
|   |-- owner/
|   |-- js/
|   |-- css/
|   `-- index.html
|-- main.py
|-- render.yaml
|-- firebase.json
|-- Dockerfile
`-- README.md
```

## Environment Variables

Create a `.env` file from `.env.example` before running the backend locally.

```env
DATABASE_URL=sqlite:///./spacesync.db
SECRET_KEY=change_this_to_a_long_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

For production with Neon, use a Postgres URL:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB_NAME?sslmode=require
DB_SSLMODE=require
```

Do not commit real `.env` values, API keys, database passwords, or Cloudinary secrets.

## Local Setup

### 1. Create and activate a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install backend dependencies

```powershell
pip install -r backend/requirements.txt
```

### 3. Create local environment file

```powershell
copy .env.example .env
```

For local SQLite development, set:

```env
DATABASE_URL=sqlite:///./spacesync.db
```

### 4. Start the backend

```powershell
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Backend docs will be available at:

```text
http://127.0.0.1:8001/docs
```

### 5. Start the frontend

Open a second terminal:

```powershell
cd frontend
python -m http.server 3001
```

Frontend URL:

```text
http://127.0.0.1:3001
```

## Frontend API Configuration

The frontend reads the backend URL from:

```text
frontend/js/runtime-config.js
```

For local development:

```js
window.__API_BASE__ = "http://127.0.0.1:8001";
```

For deployed frontend:

```js
window.__API_BASE__ = "https://your-render-backend.onrender.com";
```

`firebase.json` disables caching for this file so API URL changes are picked up quickly after deployment.

## Deployment

The current low-cost deployment path is:

- Backend API: Render Web Service
- Frontend: Firebase Hosting
- Database: Neon Postgres
- Image uploads: Cloudinary

### 1. Create the Neon database

1. Create a project in Neon.
2. Copy the pooled Postgres connection string.
3. Add it to Render as `DATABASE_URL`.

Example:

```env
DATABASE_URL=postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require
DB_SSLMODE=require
```

### 2. Create Cloudinary credentials

In Cloudinary, copy these values from the dashboard:

- Cloud name
- API key
- API secret

Add them to Render:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

All three values must come from the same Cloudinary account. If they do not match, uploads will fail with an invalid signature error.

### 3. Deploy the backend on Render

Render can use the included `render.yaml`, or you can create the service manually.

Manual settings:

- Runtime: `Python 3`
- Build command:

```bash
pip install -r backend/requirements.txt && python -m backend.ml.train_surge_pricing && python -m backend.ml.train_recommendations && python -m backend.ml.train_availability
```

- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Required Render environment variables:

- `DATABASE_URL`
- `DB_SSLMODE`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

After deployment, Render will provide a backend URL similar to:

```text
https://spacesync-api.onrender.com
```

### 4. Point the frontend to Render

Update:

```text
frontend/js/runtime-config.js
```

Set it to your deployed backend:

```js
window.__API_BASE__ = "https://spacesync-api.onrender.com";
```

### 5. Deploy the frontend on Firebase Hosting

Login once:

```powershell
firebase login
```

Select or add the Firebase project:

```powershell
firebase use --add
```

Deploy hosting:

```powershell
firebase deploy --only hosting
```

Firebase will give a URL like:

```text
https://your-project.web.app
```

## Manual Redeploy

After changing code:

```powershell
git add .
git commit -m "Describe the change"
git push
```

Backend changes:

- Render redeploys from GitHub.
- You can also click `Manual Deploy` in Render.

Frontend changes:

```powershell
firebase deploy --only hosting
```

If only the API URL changed, make sure `frontend/js/runtime-config.js` has the correct backend URL before deploying Firebase again.

## Production Checklist

- Rotate any database password that was shared publicly.
- Set a strong `SECRET_KEY` in Render.
- Confirm `DATABASE_URL` points to Neon, not local SQLite.
- Confirm Cloudinary credentials are correct.
- Confirm `frontend/js/runtime-config.js` points to the deployed Render API.
- Create one owner account and one user account.
- Add a listing as owner.
- Upload a listing photo.
- Open the listing as a user.
- Make a booking.
- Add, edit, and delete a review.
- Test slot blocking from the owner calendar.

## Troubleshooting

### `uvicorn` is not recognized

Install dependencies inside the active virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

### Backend cannot parse `DATABASE_URL`

Check that the value starts directly with `postgresql://` or `sqlite:///`.

Incorrect:

```env
DATABASE_URL=DATABASE_URL=postgresql://...
```

Correct:

```env
DATABASE_URL=postgresql://...
```

### Frontend says `Failed to fetch`

Check:

- backend service is running
- Render backend URL opens in the browser
- `frontend/js/runtime-config.js` has the correct deployed API URL
- Firebase Hosting has been redeployed after changing the API URL

### Cloudinary upload fails with `Invalid Signature`

Recheck all three Cloudinary values in Render:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Remove extra spaces or quotes. Redeploy the Render service after updating them.

### Owner or browse page looks blank after deploy

This is usually an old cached frontend file.

Try:

```powershell
firebase deploy --only hosting
```

Then open the site in an incognito window or add a cache-busting query string:

```text
https://your-project.web.app/?v=latest
```

## Notes

- Razorpay support can be added later without changing the current deployment plan.
- The backend still supports local uploads as a fallback, but Cloudinary is the recommended option for hosted deployments.
- Firebase is used here only for static hosting. The backend, auth, and database are still handled by FastAPI and SQLAlchemy.
