"""In-memory хранилище.

Глобальные словари живут в рамках процесса; после перезапуска данные
сбрасываются (это допустимо по требованиям). База данных не используется.
Хранилище стартует пустым — типы событий создаются через admin API.
"""

from __future__ import annotations

from threading import Lock
from typing import Dict

# key = event_type["id"]
event_types: Dict[str, dict] = {}
# key = booking["id"] (UUID)
bookings: Dict[str, dict] = {}

# Lock для синхронизации доступа к shared state (multi-threaded gunicorn).
lock = Lock()
