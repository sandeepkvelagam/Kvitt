#!/bin/bash
# Kvitt - Environment Setup Script (Bash)
# Copies .env.example to .env for backend, frontend, and mobile

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pair in "backend:backend" "frontend:frontend" "mobile:mobile"; do
    dir="${pair%%:*}"
    src="$ROOT/$dir/.env.example"
    dst="$ROOT/$dir/.env"

    if [ ! -f "$src" ]; then
        echo "Warning: Source not found: $src"
        continue
    fi

    if [ -f "$dst" ]; then
        echo "Skipping $dir/.env - already exists"
    else
        cp "$src" "$dst"
        echo "Created $dir/.env"
    fi
done

echo ""
echo "Next: Edit backend/.env, frontend/.env, mobile/.env with your API keys."
echo "See docs/SETUP_KEYS.md for step-by-step instructions."
