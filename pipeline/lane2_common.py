"""Shared paths, source cache helpers, and validation for lane 2 generators."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "public" / "data"
RAW = ROOT / "data" / "raw" / "lane2"
load_dotenv(ROOT / ".env")


def require_key(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is missing. Copy .env.example to .env and add your own key.")
    return value


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    """Atomically write compact JSON so an interrupted run never leaves half a dataset."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    fd, name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(payload)
            out.flush()
            os.fsync(out.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def hikes() -> list[dict[str, Any]]:
    rows = read_json(DATA / "hikes.json")
    if not isinstance(rows, list) or not rows:
        raise ValueError("hikes.json must contain a non-empty list")
    return rows


def round1(value: float) -> float:
    return round(float(value) + 1e-10, 1)


def ensure_finite(rows: list[dict[str, Any]], fields: tuple[str, ...]) -> None:
    import math

    for i, row in enumerate(rows):
        for field in fields:
            value = row[field]
            if not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(f"row {i} has a non-finite {field}: {value!r}")

