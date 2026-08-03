import os
import time
import hmac
import json
import base64
import hashlib
import secrets
from dotenv import load_dotenv
from fastapi import Header, HTTPException, Depends

load_dotenv()

AUTH_SECRET = os.getenv("AUTH_SECRET", "")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
PBKDF2_ITERATIONS = 200_000


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Returns (password_hash, salt). Generates a new random salt if none given."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS)
    return digest.hex(), salt


def verify_password_hash(password: str, salt: str, expected_hash: str) -> bool:
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, expected_hash)


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(payload_b64: str) -> str:
    signature = hmac.new(AUTH_SECRET.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return _b64encode(signature)


def create_token(name: str) -> str:
    payload = json.dumps({"exp": int(time.time()) + TOKEN_TTL_SECONDS, "name": name}).encode()
    payload_b64 = _b64encode(payload)
    return f"{payload_b64}.{_sign(payload_b64)}"


def decode_token(token: str) -> dict | None:
    try:
        payload_b64, signature = token.split(".")
    except ValueError:
        return None

    if not hmac.compare_digest(signature, _sign(payload_b64)):
        return None

    try:
        payload = json.loads(_b64decode(payload_b64))
    except (ValueError, json.JSONDecodeError):
        return None

    if payload.get("exp", 0) <= time.time() or not payload.get("name"):
        return None

    return payload


def require_auth(authorization: str | None = Header(None)) -> dict:
    """Returns the decoded token payload (contains 'name') for the logged-in HR."""
    if not AUTH_SECRET:
        raise HTTPException(status_code=500, detail="Server auth is not configured (AUTH_SECRET missing)")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session, please log in again")

    return payload


# FastAPI dependency instance, reused where we don't need the payload value itself
auth_required = Depends(require_auth)
