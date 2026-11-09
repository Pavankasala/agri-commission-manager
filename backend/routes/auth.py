from datetime import datetime
import re

from flask import Blueprint, current_app, g, jsonify, request

import db
from security import (
    create_access_token,
    hash_password,
    require_admin,
    require_auth,
    verify_google_credential,
    verify_password,
)


auth_bp = Blueprint("auth", __name__)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def normalize_user(user_data):
    if not user_data:
        return None
    user = dict(user_data)
    user.pop("password", None)
    user["business_name"] = user.get("company_full_name") or user.get("company_name") or "Agri Commission Manager"
    user["owner_name"] = user.get("name") or user.get("user_name") or "Operator"
    user["phone"] = user.get("mobile") or ""

    status = str(user.get("status") or "PENDING").upper()
    role = str(user.get("role") or user.get("user_type") or "USER").upper()
    user_type = str(user.get("user_type") or "").upper()
    is_admin = bool(role == "ADMIN" or user_type == "ADMIN" or user.get("user_id") == 1)
    is_approved = bool(user.get("is_approved")) or status == "APPROVED" or is_admin

    user["status"] = "APPROVED" if is_admin else status
    user["is_approved"] = is_approved
    user["role"] = "ADMIN" if is_admin else role
    user["is_admin"] = is_admin
    user["created_at"] = str(user.get("created_at") or "")
    return user


def _new_username(cursor, email: str, p: str) -> str:
    base = re.sub(r"[^a-z0-9_.-]", "", email.split("@", 1)[0].lower()) or "user"
    table = db.user_table()
    candidate = base[:90]
    suffix = 1
    while True:
        cursor.execute(f"SELECT 1 FROM {table} WHERE LOWER(user_name) = {p}", (candidate,))
        if not cursor.fetchone():
            return candidate
        suffix += 1
        candidate = f"{base[:85]}{suffix}"


def _response_for_user(user):
    user_obj = normalize_user(user)
    token = create_access_token(user_obj["user_id"])
    return jsonify(
        {
            "success": True,
            "user": user_obj,
            "access_token": token,
            "token": token,
            "status": user_obj["status"],
            "is_approved": user_obj["is_approved"],
            "is_admin": user_obj["is_admin"],
        }
    )



@auth_bp.route("/api/login", methods=["POST"])
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email_or_user = str(data.get("email") or data.get("username") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email_or_user or not password:
        return jsonify({"success": False, "message": "Email/username and password are required"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(
            f"SELECT * FROM {table} WHERE LOWER(user_name) = {p} OR LOWER(email) = {p}",
            (email_or_user, email_or_user),
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "Incorrect email/username or password"}), 401

        valid, needs_rehash = verify_password(dict(user).get("password"), password)
        if not valid:
            return jsonify({"success": False, "message": "Incorrect email/username or password"}), 401

        user_dict = dict(user)
        # Check approval status
        is_admin = bool(
            user_dict.get("role") == "ADMIN"
            or user_dict.get("user_type") == "ADMIN"
            or user_dict.get("user_id") == 1
        )
        status = str(user_dict.get("status") or ("APPROVED" if is_admin else "PENDING")).upper()
        is_approved = bool(user_dict.get("is_approved")) or status == "APPROVED" or is_admin

        if not is_approved and not is_admin:
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

        if needs_rehash:
            cursor.execute(
                f"UPDATE {table} SET password = {p} WHERE user_id = {p}",
                (hash_password(password), user_dict["user_id"]),
            )
            conn.commit()
            cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (user_dict["user_id"],))
            user = cursor.fetchone()

        return _response_for_user(user)
    finally:
        conn.close()


@auth_bp.route("/api/signup", methods=["POST"])
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400
    if not EMAIL_RE.fullmatch(email):
        return jsonify({"success": False, "message": "Please enter a valid email address"}), 400
    if len(password) < 8:
        return jsonify({"success": False, "message": "Password must be at least 8 characters"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT user_id FROM {table} WHERE LOWER(email) = {p}", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "An account with this email already exists. Please sign in."}), 409

        cursor.execute(f"SELECT COUNT(*) AS count FROM {table}")
        count_row = cursor.fetchone()
        user_count = int(dict(count_row).get("count") or 0) if count_row else 0
        is_first_user = (user_count == 0)

        user_name = _new_username(cursor, email, p)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        status = "APPROVED" if is_first_user else "PENDING"
        is_approved = 1 if is_first_user else 0
        role = "ADMIN" if is_first_user else "USER"
        user_type = "ADMIN" if is_first_user else "OPE"

        cursor.execute(
            f"""
            INSERT INTO {table} (name, email, user_name, password, user_type, auth_provider, status, is_approved, role, created_at)
            VALUES ({p}, {p}, {p}, {p}, {p}, 'LOCAL', {p}, {p}, {p}, {p})
            """,
            (name, email, user_name, hash_password(password), user_type, status, is_approved, role, now_str),
        )
        conn.commit()
        cursor.execute(f"SELECT * FROM {table} WHERE LOWER(email) = {p}", (email,))
        user = cursor.fetchone()

        if is_first_user:
            response = _response_for_user(user)
            response.status_code = 201
            return response
        else:
            user_obj = normalize_user(user)
            return jsonify({
                "success": True,
                "pending_approval": True,
                "status": "PENDING",
                "message": "Account created successfully! Your request has been sent for administrator approval. You can access the application once approved.",
                "user": user_obj
            }), 201
    finally:
        conn.close()


@auth_bp.route("/api/google-auth", methods=["POST"])
@auth_bp.route("/google-auth", methods=["POST"])
def google_auth():
    data = request.get_json(silent=True) or {}
    credential = str(data.get("credential") or "").strip()

    if not credential and current_app.config.get("APP_ENV") != "production":
        email = str(data.get("email") or "").strip().lower()
        if not email:
            return jsonify({"success": False, "message": "Google credential or email is required"}), 400
        google_user = {"email": email, "name": str(data.get("name") or email.split("@", 1)[0]).strip()}
    else:
        try:
            google_user = verify_google_credential(credential)
        except ValueError as exc:
            message = str(exc)
            status = 503 if "not configured" in message or "not installed" in message else 401
            return jsonify({"success": False, "message": message}), status

    email = google_user["email"]
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE LOWER(email) = {p}", (email,))
        user = cursor.fetchone()

        if not user:
            cursor.execute(f"SELECT COUNT(*) AS count FROM {table}")
            count_row = cursor.fetchone()
            user_count = int(dict(count_row).get("count") or 0) if count_row else 0
            is_first_user = (user_count == 0)

            user_name = _new_username(cursor, email, p)
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            status = "APPROVED" if is_first_user else "PENDING"
            is_approved = 1 if is_first_user else 0
            role = "ADMIN" if is_first_user else "USER"
            user_type = "ADMIN" if is_first_user else "OPE"

            cursor.execute(
                f"""
                INSERT INTO {table} (name, email, user_name, user_type, auth_provider, status, is_approved, role, created_at)
                VALUES ({p}, {p}, {p}, {p}, 'GOOGLE', {p}, {p}, {p}, {p})
                """,
                (google_user["name"], email, user_name, user_type, status, is_approved, role, now_str),
            )
            conn.commit()
            cursor.execute(f"SELECT * FROM {table} WHERE LOWER(email) = {p}", (email,))
            user = cursor.fetchone()

            if is_first_user:
                return _response_for_user(user)
            else:
                return jsonify({
                    "success": True,
                    "pending_approval": True,
                    "status": "PENDING",
                    "message": "Account registered with Google! Your request has been sent for administrator approval.",
                    "user": normalize_user(user)
                }), 200
        else:
            existing = dict(user)
            is_admin = bool(
                existing.get("role") == "ADMIN"
                or existing.get("user_type") == "ADMIN"
                or existing.get("user_id") == 1
            )
            status = str(existing.get("status") or ("APPROVED" if is_admin else "PENDING")).upper()
            is_approved = bool(existing.get("is_approved")) or status == "APPROVED" or is_admin

            providers = {provider for provider in str(existing.get("auth_provider") or "").split(",") if provider}
            if "GOOGLE" not in providers:
                providers.add("GOOGLE")
                cursor.execute(
                    f"UPDATE {table} SET auth_provider = {p} WHERE user_id = {p}",
                    (",".join(sorted(providers)), existing["user_id"]),
                )
                conn.commit()
                cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (existing["user_id"],))
                user = cursor.fetchone()

            if not is_approved and not is_admin:
                if status == "REJECTED":
                    return jsonify({
                        "success": False,
                        "rejected": True,
                        "status": "REJECTED",
                        "message": "Your access request has been declined by the administrator. Please contact support.",
                        "user": normalize_user(user)
                    }), 403
                return jsonify({
                    "success": True,
                    "pending_approval": True,
                    "status": "PENDING",
                    "message": "Your account is awaiting approval from the administrator. Please wait for access to be granted.",
                    "user": normalize_user(user)
                }), 200

            return _response_for_user(user)
    finally:
        conn.close()


@auth_bp.route("/api/me", methods=["GET"])
@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (g.user_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        return jsonify({"success": True, "user": normalize_user(user)})
    finally:
        conn.close()


@auth_bp.route("/api/admin/users", methods=["GET"])
@require_admin
def list_admin_users():
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} ORDER BY user_id DESC")
        users = cursor.fetchall()
        return jsonify({
            "success": True,
            "users": [normalize_user(u) for u in users]
        })
    finally:
        conn.close()


@auth_bp.route("/api/admin/users/<int:target_id>/approve", methods=["POST"])
@auth_bp.route("/api/admin/approve-user/<int:target_id>", methods=["POST"])
@require_admin
def approve_user(target_id: int):
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        approved_val = True if db.using_postgres() else 1
        cursor.execute(
            f"UPDATE {table} SET status = 'APPROVED', is_approved = {p} WHERE user_id = {p}",
            (approved_val, target_id),
        )
        conn.commit()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        updated = cursor.fetchone()
        name = dict(updated).get("name") or dict(updated).get("email")
        return jsonify({
            "success": True,
            "message": f"Access approved for {name}.",
            "user": normalize_user(updated)
        })
    finally:
        conn.close()


@auth_bp.route("/api/admin/users/<int:target_id>/reject", methods=["POST"])
@auth_bp.route("/api/admin/reject-user/<int:target_id>", methods=["POST"])
@require_admin
def reject_user(target_id: int):
    if target_id == g.user_id:
        return jsonify({"success": False, "message": "You cannot reject your own account"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        rejected_val = False if db.using_postgres() else 0
        cursor.execute(
            f"UPDATE {table} SET status = 'REJECTED', is_approved = {p} WHERE user_id = {p}",
            (rejected_val, target_id),
        )
        conn.commit()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        updated = cursor.fetchone()
        name = dict(updated).get("name") or dict(updated).get("email")
        return jsonify({
            "success": True,
            "message": f"Access request rejected for {name}.",
            "user": normalize_user(updated)
        })
    finally:
        conn.close()


@auth_bp.route("/api/admin/users/<int:target_id>/revoke", methods=["POST"])
@auth_bp.route("/api/admin/revoke-user/<int:target_id>", methods=["POST"])
@require_admin
def revoke_user(target_id: int):
    if target_id == g.user_id:
        return jsonify({"success": False, "message": "You cannot revoke your own account"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        pending_val = False if db.using_postgres() else 0
        cursor.execute(
            f"UPDATE {table} SET status = 'PENDING', is_approved = {p} WHERE user_id = {p}",
            (pending_val, target_id),
        )
        conn.commit()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        updated = cursor.fetchone()
        name = dict(updated).get("name") or dict(updated).get("email")
        return jsonify({
            "success": True,
            "message": f"Access revoked for {name}. Status is now Pending.",
            "user": normalize_user(updated)
        })
    finally:
        conn.close()


@auth_bp.route("/api/admin/users/<int:target_id>/toggle-role", methods=["POST"])
@require_admin
def toggle_user_role(target_id: int):
    if target_id == g.user_id:
        return jsonify({"success": False, "message": "You cannot change your own role"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        user_dict = dict(user)
        is_now_admin = not (user_dict.get("role") == "ADMIN" or user_dict.get("user_type") == "ADMIN")
        new_role = "ADMIN" if is_now_admin else "USER"
        new_type = "ADMIN" if is_now_admin else "OPE"
        new_status = "APPROVED" if is_now_admin else str(user_dict.get("status") or "APPROVED")
        new_approved = (True if db.using_postgres() else 1) if is_now_admin else (user_dict.get("is_approved") or 0)

        cursor.execute(
            f"""
            UPDATE {table}
            SET role = {p}, user_type = {p}, status = {p}, is_approved = {p}
            WHERE user_id = {p}
            """,
            (new_role, new_type, new_status, new_approved, target_id),
        )
        conn.commit()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        updated = cursor.fetchone()
        role_label = "Administrator" if is_now_admin else "Operator (Standard User)"
        name = dict(updated).get("name") or dict(updated).get("email")
        return jsonify({
            "success": True,
            "message": f"Updated role for {name} to {role_label}.",
            "user": normalize_user(updated)
        })
    finally:
        conn.close()


@auth_bp.route("/api/admin/users/<int:target_id>", methods=["DELETE"])
@require_admin
def delete_user(target_id: int):
    if target_id == g.user_id:
        return jsonify({"success": False, "message": "You cannot delete your own account"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (target_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        name = dict(user).get("name") or dict(user).get("email")
        cursor.execute(f"DELETE FROM {table} WHERE user_id = {p}", (target_id,))
        conn.commit()
        return jsonify({
            "success": True,
            "message": f"User {name} has been removed."
        })
    finally:
        conn.close()


@auth_bp.route("/api/admin/pending-count", methods=["GET"])
@require_auth
def get_pending_count():
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        table = db.user_table()
        cursor.execute(f"SELECT COUNT(*) AS count FROM {table} WHERE (status = 'PENDING' OR is_approved = 0) AND user_id != 1")
        row = cursor.fetchone()
        count = int(dict(row).get("count") or 0) if row else 0
        return jsonify({"success": True, "pending_count": count})
    finally:
        conn.close()


@auth_bp.route("/api/update-profile", methods=["POST"])
@require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or data.get("owner_name") or "").strip()
    company_full_name = str(data.get("company_full_name") or data.get("business_name") or "").strip()
    mobile = str(data.get("mobile") or data.get("phone") or "").strip()
    address = str(data.get("address") or "").strip()
    try:
        default_hamali = float(data.get("default_hamali", 0) or 0)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Default hamali must be a number"}), 400
    if default_hamali < 0:
        return jsonify({"success": False, "message": "Default hamali cannot be negative"}), 400

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        table = db.user_table()
        cursor.execute(
            f"""
            UPDATE {table}
            SET name = {p}, company_full_name = {p}, mobile = {p}, address = {p}, default_hamali = {p}
            WHERE user_id = {p}
            """,
            (name, company_full_name, mobile, address, default_hamali, g.user_id),
        )
        conn.commit()
        cursor.execute(f"SELECT * FROM {table} WHERE user_id = {p}", (g.user_id,))
        user = cursor.fetchone()
        return jsonify({"success": True, "message": "Profile updated successfully", "user": normalize_user(user)})
    finally:
        conn.close()
