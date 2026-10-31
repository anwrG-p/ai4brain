"""Gate before a payload is served: JSON Schema first, then the independent solvers."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Callable

import fastjsonschema

from .solvers import verify

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "task_payload.schema.json"


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def payload_validator() -> Callable[[object], object]:
    # Draft-07 (what TS-to-JSON-Schema exporters emit), compiled to Python once: about 10x faster
    # than the interpreting jsonschema package on these payloads, which matters when BE-04 refills a
    # pool and when the tests sweep 1000 seeds per schema.
    return fastjsonschema.compile(load_schema())


def schema_problems(payload: object) -> list[str]:
    try:
        payload_validator()(payload)
    except fastjsonschema.JsonSchemaValueException as e:
        return [e.message]
    return []


def validate_payload(payload: object) -> list[str]:
    """[] when the payload matches the schema and every answer survives its solver."""
    problems = schema_problems(payload)
    if problems:
        return problems
    return verify(payload)  # type: ignore[arg-type]
