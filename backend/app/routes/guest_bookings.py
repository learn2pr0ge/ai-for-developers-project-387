"""Гостевой маршрут бронирования.

POST /bookings
Коды: 201 / 404 (нет типа) / 409 (слот занят) / 422 (валидация).
"""

from __future__ import annotations

import re
import uuid
from datetime import timedelta

from flask import Blueprint, jsonify, request

from .. import store
from ..domain.models import booking_to_dict
from ..domain.slots import (
    is_on_grid,
    is_slot_free,
    is_start_within_window,
    now_utc,
)
from ..errors import conflict, not_found, unprocessable
from ..serialization import parse_iso_utc

guest_bookings_bp = Blueprint("guest_bookings", __name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _is_valid_email(email: str) -> bool:
    if not _EMAIL_RE.match(email):
        return False
    if ".." in email:
        return False
    if "@." in email:
        return False
    domain = email.split("@")[1]
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", domain):
        return False
    return True


@guest_bookings_bp.post("/bookings")
def create_booking():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise unprocessable("Тело запроса должно быть JSON-объектом")

    event_type_id = body.get("eventTypeId")
    guest_name = body.get("guestName")
    guest_email = body.get("guestEmail")
    start_time_raw = body.get("startTime")

    # Базовая валидация полей (422).
    if not isinstance(event_type_id, str) or not event_type_id:
        raise unprocessable("eventTypeId обязателен")
    if not isinstance(guest_name, str) or not guest_name.strip():
        raise unprocessable("guestName обязателен")
    if not isinstance(guest_email, str) or not _is_valid_email(guest_email):
        raise unprocessable("guestEmail имеет некорректный формат")

    start_time = parse_iso_utc(start_time_raw)

    # Существование типа события (404).
    with store.lock:
        event_type = store.event_types.get(event_type_id)
    if event_type is None:
        raise not_found(f"Тип события '{event_type_id}' не найден")

    # Окно 14 дней и прошедшее время (422).
    if start_time <= now_utc():
        raise unprocessable("startTime не может быть в прошлом")
    if not is_start_within_window(start_time):
        raise unprocessable("startTime вне допустимого окна 14 дней")

    # Выравнивание по сетке слотов (422).
    if not is_on_grid(event_type, start_time):
        raise unprocessable("startTime не совпадает с доступным слотом")

    duration = event_type["duration"]
    start_time = start_time.replace(microsecond=0)
    end_time = start_time + timedelta(minutes=duration)

    # Конфликт слота (409) — атомарная проверка + запись.
    with store.lock:
        if not is_slot_free(start_time, end_time):
            raise conflict("Временной слот уже занят")

        booking = {
            "id": str(uuid.uuid4()),
            "event_type_id": event_type["id"],
            "event_type_name": event_type["name"],
            "event_type_duration": duration,
            "guest_name": guest_name.strip(),
            "guest_email": guest_email,
            "start_time": start_time,
            "end_time": end_time,
            "created_at": now_utc().replace(microsecond=0),
        }
        store.bookings[booking["id"]] = booking

    return jsonify(booking_to_dict(booking)), 201
