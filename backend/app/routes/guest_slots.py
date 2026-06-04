"""Гостевой маршрут слотов.

GET /event-types/{eventTypeId}/slots?date=YYYY-MM-DD
Возвращает только свободные слоты (available=true) в окне 14 дней.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from .. import store
from ..domain.slots import generate_slots
from ..errors import not_found
from ..serialization import parse_query_date

guest_slots_bp = Blueprint("guest_slots", __name__)


@guest_slots_bp.get("/event-types/<event_type_id>/slots")
def list_slots(event_type_id: str):
    with store.lock:
        et = store.event_types.get(event_type_id)
    if et is None:
        raise not_found(f"Тип события '{event_type_id}' не найден")

    day = parse_query_date(request.args.get("date"))
    slots = generate_slots(et, day)
    return jsonify(slots), 200
