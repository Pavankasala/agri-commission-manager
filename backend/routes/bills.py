import math
import uuid
from datetime import datetime

from flask import Blueprint, g, jsonify, request

import db
from security import require_auth


bills_bp = Blueprint("bills", __name__)


def _number(value, field: str, *, minimum: float = 0.0) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a number")
    if not math.isfinite(number) or number < minimum:
        raise ValueError(f"{field} must be at least {minimum}")
    return number


def _items_from_payload(data):
    raw_items = data.get("items")
    if raw_items is None:
        raw_items = [{"bags": data.get("no_of_bags"), "price": data.get("price")}]
    if not isinstance(raw_items, list) or not raw_items:
        raise ValueError("At least one bill item is required")

    items = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        try:
            bags = int(_number(item.get("bags", item.get("no_of_bags")), "Bags"))
            price = _number(item.get("price"), "Price")
        except ValueError:
            continue
        if bags > 0 and price >= 0:
            items.append(
                {
                    "bags": bags,
                    "price": price,
                    "kisan_name": str(item.get("kisanName") or item.get("sourceKisanName") or "").strip(),
                }
            )
    if not items:
        raise ValueError("At least one bill item with valid Bags and Price is required")
    return items


def _group_rows(rows, kisan_mobiles=None):
    """Convert persisted line items into the bill objects the frontend consumes."""
    groups = {}
    ordered_group_keys = []
    for raw_row in rows:
        row = dict(raw_row)
        group_key = row.get("bill_group_id") or f"legacy-{row['id']}"
        if group_key not in groups:
            bill = row.copy()
            bill["channels"] = []
            bill["line_item_ids"] = []
            bill["no_of_bags"] = 0
            bill["total_amount"] = 0.0
            bill["advance"] = 0.0
            bill["confirmed"] = bool(row.get("confirmed"))
            bill["paid_date"] = row.get("paid_date") or ""
            bill["paid_amount"] = float(row.get("paid_amount") or 0.0)
            bill["mobile"] = row.get("mobile") or ""
            groups[group_key] = bill
            ordered_group_keys.append(group_key)
        else:
            bill = groups[group_key]
            if not bill.get("mobile") and row.get("mobile"):
                bill["mobile"] = row.get("mobile")

        bill = groups[group_key]
        bags = int(row.get("no_of_bags") or 0)
        price = float(row.get("price") or 0)
        bill["channels"].append(
            {
                "id": row["id"],
                "bags": bags,
                "price": price,
                "kisanName": row.get("source_kisan_name") or "",
            }
        )
        bill["line_item_ids"].append(row["id"])
        bill["no_of_bags"] += bags
        bill["total_amount"] += bags * price
        bill["advance"] += float(row.get("advance") or 0)
        bill["confirmed"] = bool(bill["confirmed"] or row.get("confirmed"))
        if row.get("paid") == "YES":
            bill["paid"] = "YES"
            if row.get("paid_date") and not bill.get("paid_date"):
                bill["paid_date"] = row.get("paid_date")
            if row.get("paid_amount") and not bill.get("paid_amount"):
                bill["paid_amount"] = float(row.get("paid_amount") or 0.0)

    result = []
    for group_key in ordered_group_keys:
        bill = groups[group_key]
        bill["price"] = bill["total_amount"] / bill["no_of_bags"] if bill["no_of_bags"] else 0.0
        gross = bill["total_amount"]
        hamali_per_bag = float(bill.get("hamali") or 0.0)
        total_bags = int(bill.get("no_of_bags") or 0)
        hamali_deduction = hamali_per_bag * total_bags
        bill_type = bill.get("type", "")
        if bill_type == "BUY":
            commission_val = round(gross * 0.04)
            damage_val = round(gross * 0.06)
            bill["net_amount"] = max(0.0, gross - commission_val - hamali_deduction - damage_val)
        else:
            # BUYER: no deductions, net = gross
            bill["net_amount"] = gross

        advance_val = float(bill.get("advance") or 0.0)
        is_paid = (bill.get("paid") == "YES")
        unsettled_balance = max(0.0, bill["net_amount"] - advance_val)

        if is_paid:
            bill["net_payable"] = 0.0
            if not bill.get("paid_amount"):
                bill["paid_amount"] = unsettled_balance
            if not bill.get("paid_date"):
                date_part = str(bill.get("date") or "").strip()
                time_part = str(bill.get("time") or "").strip()
                bill["paid_date"] = f"{date_part} {time_part}".strip()
        else:
            bill["net_payable"] = unsettled_balance

        # Auto-fetch mobile number from kisans directory if not present on bill row
        if not bill.get("mobile") and kisan_mobiles:
            k_name = str(bill.get("name") or "").strip().lower()
            if k_name in kisan_mobiles:
                bill["mobile"] = kisan_mobiles[k_name]

        result.append(bill)
    return result


def _save_bill_lines(cursor, *, user_id, bill_type, bill_group_id, name, bill_date, bill_time, items, hamali, advance, paid, payment_mode=None, mobile=None):
    p = db.ph()
    for index, item in enumerate(items):
        cursor.execute(
            f"""
            INSERT INTO inventory (
                user_id, bill_group_id, name, source_kisan_name, mobile, no_of_bags, price,
                date, time, type, advance, hamali, paid, confirmed, payment_mode
            )
            VALUES ({p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p}, {p})
            """,
            (
                user_id,
                bill_group_id,
                name,
                item["kisan_name"] or None,
                mobile or None,
                item["bags"],
                item["price"],
                bill_date,
                bill_time,
                bill_type,
                advance if index == 0 else 0.0,
                hamali,
                paid,
                paid == "YES",
                payment_mode,
            ),
        )


def _find_owned_bill(cursor, bill_id, bill_type):
    p = db.ph()
    cursor.execute(
        f"SELECT * FROM inventory WHERE id = {p} AND user_id = {p} AND type = {p}",
        (bill_id, g.user_id, bill_type),
    )
    row = cursor.fetchone()
    if not row:
        cursor.execute(
            f"SELECT * FROM inventory WHERE bill_group_id = {p} AND user_id = {p} AND type = {p} ORDER BY id LIMIT 1",
            (str(bill_id), g.user_id, bill_type),
        )
        row = cursor.fetchone()
    return row


def _delete_bill_group(cursor, row, bill_type):
    p = db.ph()
    row_dict = dict(row)
    if row_dict.get("bill_group_id"):
        cursor.execute(
            f"DELETE FROM inventory WHERE user_id = {p} AND bill_group_id = {p} AND type = {p}",
            (g.user_id, row_dict["bill_group_id"], bill_type),
        )
    else:
        cursor.execute(
            f"DELETE FROM inventory WHERE id = {p} AND user_id = {p} AND type = {p}",
            (row_dict["id"], g.user_id, bill_type),
        )


def _get_bills_for_type(bill_type, date=None):
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        params = [g.user_id, bill_type]
        query = f"SELECT * FROM inventory WHERE user_id = {p} AND type = {p}"
        if date:
            query += f" AND date = {p}"
            params.append(date)
        query += " ORDER BY id DESC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        # Build directory of kisan mobiles from kisans table and inventory records
        cursor.execute(
            f"SELECT name, mobile FROM kisans WHERE user_id = {p} AND mobile IS NOT NULL AND mobile != ''",
            (g.user_id,),
        )
        kisan_mobiles = {}
        for r in cursor.fetchall():
            rd = dict(r)
            if rd.get("name") and rd.get("mobile"):
                kisan_mobiles[str(rd["name"]).strip().lower()] = str(rd["mobile"]).strip()

        cursor.execute(
            f"SELECT name, mobile FROM inventory WHERE user_id = {p} AND mobile IS NOT NULL AND mobile != ''",
            (g.user_id,),
        )
        for r in cursor.fetchall():
            rd = dict(r)
            k_n = str(rd.get("name") or "").strip().lower()
            if k_n and k_n not in kisan_mobiles and rd.get("mobile"):
                kisan_mobiles[k_n] = str(rd["mobile"]).strip()

        return _group_rows(rows, kisan_mobiles=kisan_mobiles)
    finally:
        conn.close()



@bills_bp.route("/api/mark-bill-paid/<int:bill_id>", methods=["POST"])
@require_auth
def mark_bill_paid(bill_id):
    """Toggle paid status (YES/NO) for a BUY or BUYER bill with payment history."""
    data = request.get_json(silent=True) or {}
    paid_val = str(data.get("paid", "YES")).upper()
    if paid_val not in ("YES", "NO"):
        paid_val = "YES"

    paid_date = data.get("paid_date")
    paid_amount = data.get("paid_amount")

    if paid_val == "YES":
        if not paid_date:
            paid_date = datetime.now().strftime("%Y-%m-%d %I:%M %p")
    else:
        paid_date = None
        paid_amount = 0.0

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        # Fetch the bill to get its group id
        cursor.execute(
            f"SELECT * FROM inventory WHERE id = {p} AND user_id = {p}",
            (bill_id, g.user_id),
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Bill not found"}), 404
        row_dict = dict(row)
        grp_id = row_dict.get("bill_group_id")

        if paid_val == "YES" and paid_amount is None:
            if grp_id:
                cursor.execute(
                    f"SELECT * FROM inventory WHERE bill_group_id = {p} AND user_id = {p}",
                    (grp_id, g.user_id),
                )
                items = cursor.fetchall()
            else:
                items = [row]
            grouped = _group_rows(items)
            if grouped:
                adv = float(grouped[0].get("advance") or 0.0)
                paid_amount = max(0.0, float(grouped[0].get("net_amount") or 0.0) - adv)
            else:
                paid_amount = 0.0

        if grp_id:
            cursor.execute(
                f"""
                UPDATE inventory 
                SET paid = {p}, confirmed = {p}, paid_date = {p}, paid_amount = {p} 
                WHERE bill_group_id = {p} AND user_id = {p}
                """,
                (paid_val, paid_val == "YES", paid_date, float(paid_amount or 0.0), grp_id, g.user_id),
            )
        else:
            cursor.execute(
                f"""
                UPDATE inventory 
                SET paid = {p}, confirmed = {p}, paid_date = {p}, paid_amount = {p} 
                WHERE id = {p} AND user_id = {p}
                """,
                (paid_val, paid_val == "YES", paid_date, float(paid_amount or 0.0), bill_id, g.user_id),
            )
        conn.commit()
        return jsonify({
            "success": True,
            "message": f"Bill marked as {paid_val}",
            "paid": paid_val,
            "paid_date": paid_date,
            "paid_amount": float(paid_amount or 0.0),
        })
    finally:
        conn.close()


@bills_bp.route("/api/home-bills", methods=["GET"])
@bills_bp.route("/home-bills", methods=["GET"])
@require_auth
def get_home_bills():
    date = request.args.get("date")
    bills = _get_bills_for_type("BUY", date)
    return jsonify({"success": True, "bills": bills, "date": date})


@bills_bp.route("/api/add-bill", methods=["POST"])
@require_auth
def add_bill():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Kisan name is required"}), 400

    try:
        items = _items_from_payload(data)
        hamali = _number(data.get("hamali", 0), "Hamali")
        advance = _number(data.get("advance", 0), "Advance")
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    mobile = str(data.get("mobile") or data.get("mobileNo") or data.get("phone") or "").strip()
    bill_date = str(data.get("billdate") or data.get("date") or datetime.now().strftime("%Y-%m-%d"))
    bill_time = str(data.get("time") or data.get("advanceTime") or datetime.now().strftime("%I:%M %p"))
    total = sum(item["bags"] * item["price"] for item in items)
    paid = "YES" if total > 0 and advance >= total else "NO"
    bill_group_id = uuid.uuid4().hex

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()

        # If mobile was not supplied in request, attempt to auto-fetch from records
        if not mobile and name:
            cursor.execute(
                f"SELECT mobile FROM kisans WHERE user_id = {p} AND LOWER(name) = {p} AND mobile IS NOT NULL AND mobile != '' LIMIT 1",
                (g.user_id, name.lower()),
            )
            found_k = cursor.fetchone()
            if found_k and dict(found_k).get("mobile"):
                mobile = str(dict(found_k)["mobile"]).strip()
            else:
                cursor.execute(
                    f"SELECT mobile FROM inventory WHERE user_id = {p} AND LOWER(name) = {p} AND mobile IS NOT NULL AND mobile != '' LIMIT 1",
                    (g.user_id, name.lower()),
                )
                inv_found = cursor.fetchone()
                if inv_found and dict(inv_found).get("mobile"):
                    mobile = str(dict(inv_found)["mobile"]).strip()

        # If mobile is present, ensure it is recorded in the kisans directory
        if mobile and name:
            cursor.execute(
                f"SELECT id, mobile FROM kisans WHERE user_id = {p} AND LOWER(name) = {p}",
                (g.user_id, name.lower()),
            )
            existing_k = cursor.fetchone()
            if existing_k:
                cursor.execute(
                    f"UPDATE kisans SET mobile = {p} WHERE id = {p}",
                    (mobile, dict(existing_k)["id"]),
                )
            else:
                cursor.execute(
                    f"INSERT INTO kisans (user_id, name, mobile) VALUES ({p}, {p}, {p})",
                    (g.user_id, name, mobile),
                )

        _save_bill_lines(
            cursor,
            user_id=g.user_id,
            bill_type="BUY",
            bill_group_id=bill_group_id,
            name=name,
            bill_date=bill_date,
            bill_time=bill_time,
            items=items,
            hamali=hamali,
            advance=advance,
            paid=paid,
            mobile=mobile,
        )
        conn.commit()
        return jsonify({"success": True, "message": "Bill added successfully", "bill_group_id": bill_group_id, "mobile": mobile}), 200
    finally:
        conn.close()


@bills_bp.route("/api/update-bill/<int:bill_id>", methods=["PUT"])
@require_auth
def update_bill(bill_id):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Kisan name is required"}), 400
    try:
        items = _items_from_payload(data)
        hamali = _number(data.get("hamali", 0), "Hamali")
        advance = _number(data.get("advance", 0), "Advance")
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    mobile = str(data.get("mobile") or data.get("mobileNo") or data.get("phone") or "").strip()
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        existing = _find_owned_bill(cursor, bill_id, "BUY")
        if not existing:
            return jsonify({"success": False, "message": "Bill not found"}), 404

        existing_dict = dict(existing)
        total = sum(item["bags"] * item["price"] for item in items)
        paid = "YES" if total > 0 and advance >= total else "NO"
        group_id = existing_dict.get("bill_group_id") or uuid.uuid4().hex

        # If mobile not given, keep existing mobile or lookup from records
        if not mobile:
            mobile = existing_dict.get("mobile") or ""
        if not mobile and name:
            cursor.execute(
                f"SELECT mobile FROM kisans WHERE user_id = {p} AND LOWER(name) = {p} AND mobile IS NOT NULL AND mobile != '' LIMIT 1",
                (g.user_id, name.lower()),
            )
            found_k = cursor.fetchone()
            if found_k and dict(found_k).get("mobile"):
                mobile = str(dict(found_k)["mobile"]).strip()

        if mobile and name:
            cursor.execute(
                f"SELECT id, mobile FROM kisans WHERE user_id = {p} AND LOWER(name) = {p}",
                (g.user_id, name.lower()),
            )
            existing_k = cursor.fetchone()
            if existing_k:
                cursor.execute(
                    f"UPDATE kisans SET mobile = {p} WHERE id = {p}",
                    (mobile, dict(existing_k)["id"]),
                )
            else:
                cursor.execute(
                    f"INSERT INTO kisans (user_id, name, mobile) VALUES ({p}, {p}, {p})",
                    (g.user_id, name, mobile),
                )

        if existing_dict.get("bill_group_id"):
            cursor.execute(
                f"SELECT * FROM inventory WHERE user_id = {p} AND bill_group_id = {p} AND type = 'BUY' ORDER BY id",
                (g.user_id, group_id),
            )
            group_rows = cursor.fetchall()
            if len(group_rows) == 1:
                row = dict(group_rows[0])
                cursor.execute(
                    f"""
                    UPDATE inventory
                    SET name = {p}, mobile = {p}, source_kisan_name = {p}, no_of_bags = {p}, price = {p},
                        date = {p}, time = {p}, advance = {p}, hamali = {p},
                        paid = {p}, confirmed = {p}
                    WHERE id = {p} AND user_id = {p} AND type = 'BUY'
                    """,
                    (
                        name,
                        mobile or None,
                        items[0]["kisan_name"] or None,
                        items[0]["bags"],
                        items[0]["price"],
                        str(data.get("date") or data.get("billdate") or row.get("date") or ""),
                        str(data.get("time") or row.get("time") or "12:00 PM"),
                        advance,
                        hamali,
                        paid,
                        paid == "YES",
                        row["id"],
                        g.user_id,
                    ),
                )
                conn.commit()
                return jsonify({"success": True, "message": "Bill updated successfully", "mobile": mobile})

        _delete_bill_group(cursor, existing, "BUY")
        _save_bill_lines(
            cursor,
            user_id=g.user_id,
            bill_type="BUY",
            bill_group_id=group_id,
            name=name,
            bill_date=str(data.get("date") or data.get("billdate") or existing_dict.get("date") or ""),
            bill_time=str(data.get("time") or existing_dict.get("time") or "12:00 PM"),
            items=items,
            hamali=hamali,
            advance=advance,
            paid=paid,
            mobile=mobile,
        )
        conn.commit()
        return jsonify({"success": True, "message": "Bill updated successfully", "mobile": mobile})
    finally:
        conn.close()


@bills_bp.route("/api/confirm-bill/<int:bill_id>", methods=["POST"])
@require_auth
def confirm_bill(bill_id):
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        existing = _find_owned_bill(cursor, bill_id, "BUY")
        if not existing:
            return jsonify({"success": False, "message": "Bill not found"}), 404
        existing_dict = dict(existing)
        p = db.ph()
        grp_id = existing_dict.get("bill_group_id")
        now_str = datetime.now().strftime("%Y-%m-%d %I:%M %p")

        if grp_id:
            cursor.execute(
                f"SELECT * FROM inventory WHERE bill_group_id = {p} AND user_id = {p}",
                (grp_id, g.user_id),
            )
            items = cursor.fetchall()
        else:
            items = [existing]
        grouped = _group_rows(items)
        if grouped:
            adv = float(grouped[0].get("advance") or 0.0)
            paid_amount = max(0.0, float(grouped[0].get("net_amount") or 0.0) - adv)
        else:
            paid_amount = 0.0

        if grp_id:
            cursor.execute(
                f"""
                UPDATE inventory 
                SET paid = 'YES', confirmed = {p}, paid_date = {p}, paid_amount = {p} 
                WHERE user_id = {p} AND bill_group_id = {p} AND type = 'BUY'
                """,
                (True, now_str, paid_amount, g.user_id, grp_id),
            )
        else:
            cursor.execute(
                f"""
                UPDATE inventory 
                SET paid = 'YES', confirmed = {p}, paid_date = {p}, paid_amount = {p} 
                WHERE id = {p} AND user_id = {p} AND type = 'BUY'
                """,
                (True, now_str, paid_amount, bill_id, g.user_id),
            )
        conn.commit()
        return jsonify({
            "success": True,
            "message": "Bill confirmed as paid",
            "paid_date": now_str,
            "paid_amount": paid_amount,
        })
    finally:
        conn.close()


@bills_bp.route("/api/delete-bill/<int:bill_id>", methods=["DELETE"])
@require_auth
def delete_bill(bill_id):
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        cursor.execute(
            f"SELECT * FROM inventory WHERE id = {p} AND user_id = {p} AND type IN ('BUY', 'BUYER')",
            (bill_id, g.user_id),
        )
        existing = cursor.fetchone()
        if not existing:
            return jsonify({"success": False, "message": "Bill not found"}), 404
        _delete_bill_group(cursor, existing, dict(existing)["type"])
        conn.commit()
        return jsonify({"success": True, "message": "Bill deleted successfully"})
    finally:
        conn.close()


@bills_bp.route("/api/buyer-bills", methods=["GET"])
@require_auth
def get_buyer_bills():
    date = request.args.get("date")
    bills = _get_bills_for_type("BUYER", date)
    return jsonify({"success": True, "bills": bills, "date": date})


def _save_buyer_bill(bill_id=None):
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Buyer name is required"}), 400
    try:
        items = _items_from_payload(data)
        hamali = _number(data.get("hamali", 0), "Hamali")
        advance = _number(data.get("advance", 0), "Advance")
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    payment_mode = str(data.get("paymentMode") or data.get("payment_mode") or "CASH").strip().upper()[:30]
    total = sum(item["bags"] * item["price"] for item in items)
    paid = "YES" if total > 0 and advance >= total else "NO"
    bill_date = str(data.get("billdate") or data.get("date") or datetime.now().strftime("%Y-%m-%d"))
    bill_time = str(data.get("time") or data.get("advanceTime") or datetime.now().strftime("%I:%M %p"))

    conn = db.get_db()
    try:
        cursor = conn.cursor()
        group_id = uuid.uuid4().hex
        if bill_id is not None:
            existing = _find_owned_bill(cursor, bill_id, "BUYER")
            if not existing:
                return jsonify({"success": False, "message": "Buyer bill not found"}), 404
            group_id = dict(existing).get("bill_group_id") or group_id
            _delete_bill_group(cursor, existing, "BUYER")

        mobile = str(data.get("mobile") or data.get("mobileNo") or data.get("phone") or "").strip()
        _save_bill_lines(
            cursor,
            user_id=g.user_id,
            bill_type="BUYER",
            bill_group_id=group_id,
            name=name,
            bill_date=bill_date,
            bill_time=bill_time,
            items=items,
            hamali=hamali,
            advance=advance,
            paid=paid,
            payment_mode=payment_mode,
            mobile=mobile,
        )
        conn.commit()
        message = "Buyer bill updated successfully" if bill_id is not None else "Buyer bill saved successfully"
        return jsonify({"success": True, "message": message, "bill_group_id": group_id}), 200
    finally:
        conn.close()


@bills_bp.route("/api/add-buyer-bill", methods=["POST"])
@require_auth
def add_buyer_bill():
    return _save_buyer_bill()


@bills_bp.route("/api/update-buyer-bill/<int:bill_id>", methods=["PUT"])
@require_auth
def update_buyer_bill(bill_id):
    return _save_buyer_bill(bill_id)


@bills_bp.route("/api/not-paid-bills", methods=["GET"])
@require_auth
def get_not_paid_bills():
    year = request.args.get("year", "").strip()
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        query = f"SELECT * FROM inventory WHERE user_id = {p} AND type = 'BUY' AND (paid IS NULL OR paid != 'YES')"
        params = [g.user_id]
        if year:
            query += f" AND date LIKE {p}"
            params.append(f"{year}%")
        query += " ORDER BY id DESC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.execute(
            f"SELECT name, mobile FROM kisans WHERE user_id = {p} AND mobile IS NOT NULL AND mobile != ''",
            (g.user_id,),
        )
        kisan_mobiles = {}
        for r in cursor.fetchall():
            rd = dict(r)
            if rd.get("name") and rd.get("mobile"):
                kisan_mobiles[str(rd["name"]).strip().lower()] = str(rd["mobile"]).strip()
        return jsonify({"success": True, "bills": _group_rows(rows, kisan_mobiles=kisan_mobiles)})
    finally:
        conn.close()


@bills_bp.route("/api/paid-bills", methods=["GET"])
@require_auth
def get_paid_bills():
    date = request.args.get("date")
    conn = db.get_db()
    try:
        cursor = conn.cursor()
        p = db.ph()
        query = f"SELECT * FROM inventory WHERE user_id = {p} AND type = 'BUY' AND paid = 'YES'"
        params = [g.user_id]
        if date:
            query += f" AND date = {p}"
            params.append(date)
        query += " ORDER BY id DESC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.execute(
            f"SELECT name, mobile FROM kisans WHERE user_id = {p} AND mobile IS NOT NULL AND mobile != ''",
            (g.user_id,),
        )
        kisan_mobiles = {}
        for r in cursor.fetchall():
            rd = dict(r)
            if rd.get("name") and rd.get("mobile"):
                kisan_mobiles[str(rd["name"]).strip().lower()] = str(rd["mobile"]).strip()
        return jsonify({"success": True, "bills": _group_rows(rows, kisan_mobiles=kisan_mobiles)})
    finally:
        conn.close()
