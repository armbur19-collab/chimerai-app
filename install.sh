#!/bin/bash
set -e

echo ""
echo "================================================"
echo "  ChimerAI Project Setup (SQLite - No Docker needed)"
echo "================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed"
    exit 1
fi

if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "[INFO] .env not found - creating from .env.example"
    cp .env.example .env
    echo "[INFO] Edit .env to add your API keys before using AI features."
    echo ""
fi

echo "[1/3] Installing dependencies..."
npm install

echo "[2/3] Setting up database..."
npm run db:push

echo "[3/3] Seeding database..."
npm run db:seed || echo "[WARNING] Seeding failed, but you can continue"

echo ""
echo "================================================"
echo "  Setup completed successfully!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  npm run dev"
echo "  Open: http://localhost:3001"
echo ""
echo "Login with:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
echo ""
