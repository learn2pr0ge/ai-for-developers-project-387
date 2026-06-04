"""Админские маршруты типов событий (CRUD).

GET    /admin/event-types
POST   /admin/event-types          201 / 409 / 422
GET    /admin/event-types/{id}     200 / 404
PUT    /admin/event-types/{id}     200 / 404 / 422
DELETE /admin/event-types/{id}     204 / 404 / 409
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from .. import store
from ..domain.models import event_type_to_dict
from ..domain.slots import DEFAULT_WORK_END, DEFAULT_WORK_START, now_utc
from ..errors import conflict, not_found, unprocessable
from ..serialization import parse_hhmm

admin_event_types_bp = Blueprint("admin_event_types", __name__)


def _parse_event_type_input(body: object, *, force_id: str | None = None) -> dict:
    """Валидирует тело EventTypeInput. force_id (для PUT) приоритетен над body.id."""
    if not isinstance(body, dict):
        raise unprocessable("Тело запроса должно быть JSON-объектом")

    raw_id = force_id if force_id is not None else body.get("id")
    name = body.get("name")
    description = body.get("description", "")
    duration = body.get("duration")

    if not isinstance(raw_id, str) or not raw_id.strip():
        raise unprocessable("id обязателен")
    if not isinstance(name, str) or not name.strip():
        raise unprocessable("name обязателен")
    if not isinstance(description, str):
        raise unprocessable("description должен быть строкой")
    if not isinstance(duration, int) or isinstance(duration, bool) or duration < 1:
        raise unprocessable("duration должен быть целым числом >= 1")

    # Флаг круглосуточной доступности (опциональный, дефолт false).
    available_24h = body.get("available24h", False)
    if not isinstance(available_24h, bool):
        raise unprocessable("available24h должен быть boolean")

    if available_24h:
        # Часы полностью игнорируются; храним дефолты для совместимости.
        if duration > 24 * 60:
            raise unprocessable("duration не может превышать 24 часа")
        work_start_str = DEFAULT_WORK_START
        work_end_str = DEFAULT_WORK_END
    else:
        # Рабочие часы (опциональные, дефолт 09:00-18:00, UTC).
        work_start_raw = body.get("workStartTime") or DEFAULT_WORK_START
        work_end_raw = body.get("workEndTime") or DEFAULT_WORK_END
        work_start = parse_hhmm(work_start_raw, field="workStartTime")
        work_end = parse_hhmm(work_end_raw, field="workEndTime")

        start_minutes = work_start.hour * 60 + work_start.minute
        end_minutes = work_end.hour * 60 + work_end.minute
        if start_minutes >= end_minutes:
            raise unprocessable("workStartTime должен быть раньше workEndTime")
        if end_minutes - start_minutes < duration:
            raise unprocessable(
                "Интервал рабочих часов должен вмещать хотя бы один слот (duration)"
            )
        work_start_str = work_start.strftime("%H:%M")
        work_end_str = work_end.strftime("%H:%M")

    return {
        "id": raw_id.strip(),
        "name": name.strip(),
        "description": description,
        "duration": duration,
        "work_start_time": work_start_str,
        "work_end_time": work_end_str,
        "available_24h": available_24h,
    }


def _has_upcoming_bookings(event_type_id: str) -> bool:
    now = now_utc()
    return any(
        b["event_type_id"] == event_type_id and b["end_time"] > now
        for b in list(store.bookings.values())
    )


@admin_event_types_bp.get("/admin/event-types")
def list_event_types():
    with store.lock:
        items = [event_type_to_dict(et) for et in store.event_types.values()]
    return jsonify(items), 200


@admin_event_types_bp.post("/admin/event-types")
def create_event_type():
    data = _parse_event_type_input(request.get_json(silent=True))
    with store.lock:
        if data["id"] in store.event_types:
            raise conflict(f"Тип события '{data['id']}' уже существует")
        store.event_types[data["id"]] = data
    return jsonify(event_type_to_dict(data)), 201


@admin_event_types_bp.get("/admin/event-types/<event_type_id>")
def get_event_type(event_type_id: str):
    with store.lock:
        et = store.event_types.get(event_type_id)
    if et is None:
        raise not_found(f"Тип события '{event_type_id}' не найден")
    return jsonify(event_type_to_dict(et)), 200


@admin_event_types_bp.put("/admin/event-types/<event_type_id>")
def update_event_type(event_type_id: str):
    with store.lock:
        if event_type_id not in store.event_types:
            raise not_found(f"Тип события '{event_type_id}' не найден")
        # id в пути приоритетен (replace).
        data = _parse_event_type_input(request.get_json(silent=True), force_id=event_type_id)
        store.event_types[event_type_id] = data
    return jsonify(event_type_to_dict(data)), 200


@admin_event_types_bp.delete("/admin/event-types/<event_type_id>")
def delete_event_type(event_type_id: str):
    with store.lock:
        if event_type_id not in store.event_types:
            raise not_found(f"Тип события '{event_type_id}' не найден")
        if _has_upcoming_bookings(event_type_id):
            raise conflict("Нельзя удалить: есть предстоящие бронирования")
        del store.event_types[event_type_id]
    return "", 204
