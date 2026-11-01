"""Gate before a payload is served: JSON Schema first, then the independent solvers."""

from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from typing import Callable

import fastjsonschema

from .solvers import verify

SCHEMA_FILE = "task_payload.schema.json"  # package data of dynamic_cache.generators


def load_schema() -> dict:
    """The served schema, read as package data so it works from an installed wheel too."""
    text = resources.files(__package__).joinpath(SCHEMA_FILE).read_text(encoding="utf-8")
    return json.loads(text)


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
