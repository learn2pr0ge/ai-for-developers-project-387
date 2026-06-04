"""Гостевые маршруты типов событий.

GET /event-types
GET /event-types/{eventTypeId}
"""

from __future__ import annotations

from flask import Blueprint, jsonify

from .. import store
from ..domain.models import event_type_to_dict
from ..errors import not_found

guest_event_types_bp = Blueprint("guest_event_types", __name__)


@guest_event_types_bp.get("/event-types")
def list_event_types():
    with store.lock:
        items = [event_type_to_dict(et) for et in store.event_types.values()]
    return jsonify(items), 200


@guest_event_types_bp.get("/event-types/<event_type_id>")
def get_event_type(event_type_id: str):
    with store.lock:
        et = store.event_types.get(event_type_id)
    if et is None:
        raise not_found(f"Тип события '{event_type_id}' не найден")
    return jsonify(event_type_to_dict(et)), 200
