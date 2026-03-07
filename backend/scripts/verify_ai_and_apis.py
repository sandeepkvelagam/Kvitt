#!/usr/bin/env python3
"""
Verify AI Assistant and Key APIs

Run with: python scripts/verify_ai_and_apis.py [--url URL] [--token JWT]

Examples:
  python scripts/verify_ai_and_apis.py
  python scripts/verify_ai_and_apis.py --url https://kvitt.duckdns.org
  python scripts/verify_ai_and_apis.py --url http://localhost:8000 --token eyJ...
"""

import argparse
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=os.getenv("BACKEND_URL", "http://localhost:8000"))
    parser.add_argument("--token", default=os.getenv("AUTH_TOKEN"))
    args = parser.parse_args()
    base = args.url.rstrip("/")
    api = f"{base}/api"
    headers = {}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"

    print(f"Testing {api}")
    print("-" * 50)

    errors = []
    passed = 0

    # 1. Health / unauthenticated
    try:
        r = httpx.get(f"{base}/health", timeout=10)
        if r.status_code == 200:
            print("OK  GET /health")
            passed += 1
        else:
            print(f"FAIL GET /health -> {r.status_code}")
            errors.append("health")
    except Exception as e:
        print(f"FAIL GET /health -> {e}")
        errors.append("health")

    # 2. Assistant usage (requires auth)
    try:
        r = httpx.get(f"{api}/assistant/usage", headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            print(f"OK  GET /assistant/usage -> limit={data.get('daily_limit')}, remaining={data.get('requests_remaining')}")
            passed += 1
        elif r.status_code == 401:
            print("SKIP GET /assistant/usage (401 - need token)")
        else:
            print(f"FAIL GET /assistant/usage -> {r.status_code}")
            errors.append("assistant/usage")
    except Exception as e:
        print(f"FAIL GET /assistant/usage -> {e}")
        errors.append("assistant/usage")

    # 3. Assistant ask (requires auth)
    if args.token:
        try:
            r = httpx.post(
                f"{api}/assistant/ask",
                json={"message": "How do I create a group?"},
                headers=headers,
                timeout=30,
            )
            if r.status_code == 200:
                data = r.json()
                resp = data.get("response", "")[:80]
                src = data.get("source", "?")
                print(f"OK  POST /assistant/ask -> source={src}, response={resp}...")
                passed += 1
            else:
                print(f"FAIL POST /assistant/ask -> {r.status_code} {r.text[:200]}")
                errors.append("assistant/ask")
        except Exception as e:
            print(f"FAIL POST /assistant/ask -> {e}")
            errors.append("assistant/ask")
    else:
        print("SKIP POST /assistant/ask (no token - set AUTH_TOKEN or --token)")

    # 4. Auth me (requires auth)
    try:
        r = httpx.get(f"{api}/auth/me", headers=headers, timeout=10)
        if r.status_code == 200:
            print("OK  GET /auth/me")
            passed += 1
        elif r.status_code == 401:
            print("SKIP GET /auth/me (401 - need token)")
        else:
            print(f"FAIL GET /auth/me -> {r.status_code}")
            errors.append("auth/me")
    except Exception as e:
        print(f"FAIL GET /auth/me -> {e}")
        errors.append("auth/me")

    print("-" * 50)
    print(f"Passed: {passed} | Errors: {len(errors)}")
    if errors:
        print(f"Failed: {', '.join(errors)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
