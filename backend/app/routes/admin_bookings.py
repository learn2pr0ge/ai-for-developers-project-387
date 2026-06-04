"""Админские маршруты бронирований.

GET    /admin/bookings?eventTypeId&from&to   200
GET    /admin/bookings/{id}                   200 / 404
DELETE /admin/bookings/{id}                   204 / 404
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

from flask import Blueprint, jsonify, request

from .. import store
from ..domain.models import booking_to_dict
from ..errors import not_found
from ..serialization import parse_query_date

admin_bookings_bp = Blueprint("admin_bookings", __name__)


@admin_bookings_bp.get("/admin/bookings")
def list_bookings():
    event_type_id = request.args.get("eventTypeId")
    date_from = parse_query_date(request.args.get("from"))
    date_to = parse_query_date(request.args.get("to"))

    with store.lock:
        items = list(store.bookings.values())

    if event_type_id:
        items = [b for b in items if b["event_type_id"] == event_type_id]

    if date_from is not None:
        start = datetime.combine(date_from, time(0, 0), tzinfo=timezone.utc)
        items = [b for b in items if b["start_time"] >= start]

    if date_to is not None:
        # `to` включительно: до конца указанного дня.
        end = datetime.combine(
            date_to + timedelta(days=1), time(0, 0), tzinfo=timezone.utc
        )
        items = [b for b in items if b["start_time"] < end]

    items.sort(key=lambda b: b["start_time"])
    return jsonify([booking_to_dict(b) for b in items]), 200


@admin_bookings_bp.get("/admin/bookings/<booking_id>")
def get_booking(booking_id: str):
    with store.lock:
        b = store.bookings.get(booking_id)
    if b is None:
        raise not_found(f"Бронирование '{booking_id}' не найдено")
    return jsonify(booking_to_dict(b)), 200


@admin_bookings_bp.delete("/admin/bookings/<booking_id>")
def cancel_booking(booking_id: str):
    with store.lock:
        if booking_id not in store.bookings:
            raise not_found(f"Бронирование '{booking_id}' не найдено")
        del store.bookings[booking_id]
    return "", 204
