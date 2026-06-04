"""Бизнес-логика слотов: генерация сетки, проверка конфликтов и окна.

Рабочие часы — 09:00-18:00 по UTC (см. техзадание). Окно бронирования —
[today, today + 14 days) по UTC. Шаг сетки равен duration типа события.

Замечание: фронтенд строит сетку по локальному времени браузера. При
несовпадении таймзоны браузера с UTC отметки available могут визуально
не совпадать — это следствие выбора «рабочие часы в UTC».
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from .. import store
from ..serialization import iso_z, parse_hhmm

WORK_START_HOUR = 9
WORK_END_HOUR = 18
DEFAULT_WORK_START = "09:00"
DEFAULT_WORK_END = "18:00"
BOOKING_WINDOW_DAYS = 14


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_utc() -> date:
    return now_utc().date()


def window_days() -> list[date]:
    """Список дней окна бронирования, начиная с сегодня (UTC)."""
    start = today_utc()
    return [start + timedelta(days=i) for i in range(BOOKING_WINDOW_DAYS)]


def is_within_window(day: date) -> bool:
    """Входит ли день в окно [today, today + 14 days)."""
    start = today_utc()
    return start <= day < start + timedelta(days=BOOKING_WINDOW_DAYS)


def is_start_within_window(start_dt: datetime) -> bool:
    """Входит ли startTime в окно [now, now + 14 days)."""
    start_window = now_utc()
    end_window = datetime.combine(
        today_utc() + timedelta(days=BOOKING_WINDOW_DAYS),
        time(0, 0),
        tzinfo=timezone.utc,
    )
    return start_window <= start_dt < end_window


def is_slot_free(start_time: datetime, end_time: datetime) -> bool:
    """Свободен ли интервал [start, end) — нет пересечений с бронированиями."""
    for b in list(store.bookings.values()):
        if start_time < b["end_time"] and b["start_time"] < end_time:
            return False
    return True


def _work_hours(event_type: dict) -> tuple[time, time]:
    """Рабочие часы типа события (UTC). По умолчанию 09:00-18:00."""
    start = parse_hhmm(
        event_type.get("work_start_time", DEFAULT_WORK_START), field="workStartTime"
    )
    end = parse_hhmm(
        event_type.get("work_end_time", DEFAULT_WORK_END), field="workEndTime"
    )
    return start, end


def _day_bounds(
    day: date, event_type: dict
) -> tuple[datetime, datetime]:
    """Границы сетки для дня (UTC). Для 24ч — [00:00, следующий день 00:00)."""
    if event_type.get("available_24h", False):
        day_start = datetime.combine(day, time(0, 0), tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        return day_start, day_end
    work_start, work_end = _work_hours(event_type)
    day_start = datetime.combine(day, work_start, tzinfo=timezone.utc)
    day_end = datetime.combine(day, work_end, tzinfo=timezone.utc)
    return day_start, day_end


def _day_grid_starts(
    day: date, duration: int, event_type: dict
) -> list[datetime]:
    """Времена начала слотов сетки для дня (UTC) с шагом duration."""
    day_start, day_end = _day_bounds(day, event_type)
    starts: list[datetime] = []
    cursor = day_start
    step = timedelta(minutes=duration)
    while cursor + step <= day_end:
        starts.append(cursor)
        cursor = cursor + step
    return starts


def generate_slots(event_type: dict, day: date | None) -> list[dict]:
    """Свободные слоты (available=true) для типа события.

    Если day задан и вне окна — пустой список. Если day=None — слоты по
    всему окну. Прошедшие слоты (start <= now) исключаются.
    """
    duration = event_type["duration"]
    days: list[date]
    if day is None:
        days = window_days()
    elif is_within_window(day):
        days = [day]
    else:
        return []

    now = now_utc()
    result: list[dict] = []
    for d in days:
        for start in _day_grid_starts(d, duration, event_type):
            end = start + timedelta(minutes=duration)
            if start <= now:
                continue
            if not is_slot_free(start, end):
                continue
            result.append(
                {
                    "startTime": iso_z(start),
                    "endTime": iso_z(end),
                    "available": True,
                }
            )
    return result


def is_on_grid(event_type: dict, start_dt: datetime) -> bool:
    """Совпадает ли startTime с валидным слотом сетки для данного дня."""
    duration = event_type["duration"]
    starts = _day_grid_starts(start_dt.date(), duration, event_type)
    target = start_dt.replace(microsecond=0)
    return any(s == target for s in starts)
