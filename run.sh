#!/bin/bash
# SpaceSync — one-command startup
# Usage: bash run.sh

set -e
cd "$(dirname "$0")"

echo "🏟️  SpaceSync Startup"
echo "=========================="

# 1. Install dependencies
echo "📦 Installing dependencies..."
pip install -r backend/requirements.txt -q

# 2. Train ML models
echo "🤖 Training ML models..."
python -m backend.ml.train_surge_pricing
python -m backend.ml.train_recommendations
python -m backend.ml.train_availability

# 3. Seed database with demo data
echo "🌱 Seeding database..."
python seed.py

# 4. Start API
echo ""
echo "🚀 Starting API at http://localhost:8000"
echo "📖 Swagger docs at http://localhost:8000/docs"
echo ""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
