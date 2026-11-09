"""Authentication and password helpers shared by Flask routes."""

from __future__ import annotations

import hashlib
import hmac
import re
from functools import wraps
from typing import Any

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash


import bcrypt
from flask_jwt_extended import (
    create_access_token as jwt_create_access_token,
    decode_token,
    get_jwt_identity,
    jwt_required,
    verify_jwt_in_request,
)

LEGACY_MD5_RE = re.compile(r"^[a-f0-9]{32}$", re.IGNORECASE)


def create_access_token(user_id: int) -> str:
    """Create a signed JWT token whose subject/identity is the user ID."""
    return jwt_create_access_token(identity=str(user_id))


def get_authenticated_user_id(req=request) -> int | None:
    """Read the user ID subject from a valid Bearer token."""
    header = req.headers.get("Authorization", "") if req else ""
    if header.startswith("Bearer "):
        token = header.removeprefix("Bearer ").strip()
        if token:
            try:
                decoded = decode_token(token)
                identity = decoded.get("sub")
                if identity:
                    return int(identity)
            except Exception:
                pass
    return None


def require_auth(view):
    """Require a valid JWT token, verify user approval, and make user info available."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        if request.method == "OPTIONS":
            return view(*args, **kwargs)

        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({"success": False, "message": "Missing or invalid authorization token"}), 401

        identity = get_jwt_identity()
        try:
            g.user_id = int(identity)
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid user token"}), 401

        import db
        conn = db.get_db()
        try:
            cursor = conn.cursor()
            p = db.ph()
            cursor.execute(
                f"SELECT user_id, user_name, email, name, user_type, role, status, is_approved FROM {db.user_table()} WHERE user_id = {p}",
                (g.user_id,),
            )
            user_row = cursor.fetchone()
            if not user_row:
                return jsonify({"success": False, "message": "User not found"}), 401

            user_dict = dict(user_row)
            g.current_user = user_dict
            user_role = str(user_dict.get("role") or user_dict.get("user_type") or "USER").upper()
            user_type = str(user_dict.get("user_type") or "").upper()
            g.user_role = "ADMIN" if (user_role == "ADMIN" or user_type == "ADMIN" or g.user_id == 1) else user_role
            g.is_admin = (g.user_role == "ADMIN")

            # Check approval status
            status = str(user_dict.get("status") or ("APPROVED" if g.is_admin else "PENDING")).upper()
            is_approved = bool(user_dict.get("is_approved")) or status == "APPROVED" or g.is_admin
            if not is_approved and not g.is_admin:
                if status == "REJECTED":
                    return jsonify({
                        "success": False,
                        "rejected": True,
                        "status": "REJECTED",
                        "message": "Your access request has been declined by the administrator. Please contact support."
                    }), 403
                return jsonify({
                    "success": False,
                    "pending_approval": True,
                    "status": "PENDING",
                    "message": "Your account is awaiting approval from the administrator. Please wait for access to be granted."
                }), 403
        finally:
            conn.close()

        return view(*args, **kwargs)

    return wrapped


def require_admin(view):
    """Require authenticated user with administrator privileges."""

    @wraps(view)
    @require_auth
    def wrapped(*args, **kwargs):
        if request.method == "OPTIONS":
            return view(*args, **kwargs)

        if not getattr(g, "is_admin", False):
            return jsonify({"success": False, "message": "Administrator privileges required"}), 403
        return view(*args, **kwargs)

    return wrapped


def hash_password(password: str) -> str:
    """Hash a password securely using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(stored_hash: str | None, password: str) -> tuple[bool, bool]:
    """Return (is_valid, needs_rehash).

    MD5 & Werkzeug hashes are supported for legacy user migration.
    """
    if not stored_hash or not password:
        return False, False

    if LEGACY_MD5_RE.fullmatch(stored_hash):
        supplied_md5 = hashlib.md5(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(stored_hash.lower(), supplied_md5), True

    try:
        if stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$"):
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")), False
        return check_password_hash(stored_hash, password), True
    except Exception:
        return False, False



def verify_google_credential(credential: str) -> dict[str, Any]:
    """Verify a Google ID token and return its validated identity claims."""
    client_id = current_app.config.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise ValueError("Google sign-in is not configured on this server")
    if not credential:
        raise ValueError("Google credential is required")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as exc:
        current_app.logger.exception("Failed to import Google auth packages: %s", exc)
        raise ValueError("Google sign-in support is not installed on the server") from exc


    try:
        claims = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            audience=client_id,
        )
    except Exception as exc:
        raise ValueError("Google credential could not be verified") from exc

    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("Google credential has an invalid issuer")
    if not claims.get("email_verified"):
        raise ValueError("Google account email is not verified")

    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Google credential did not include an email address")

    return {
        "email": email,
        "name": str(claims.get("name") or email.split("@", 1)[0]).strip(),
        "subject": str(claims.get("sub") or ""),
    }
