"""Gate before a payload is served: JSON Schema first, then the independent solvers."""

from __future__ import annotations

import copy
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


def _unserved_schema() -> dict:
    """The served schema with StroopInkUnserved (adds black) in place of StroopInk. Only for the
    cvd_safe preset until Stroop.tsx maps black; never use it to gate what is served."""
    schema = copy.deepcopy(load_schema())
    schema["definitions"]["StroopInk"] = schema["definitions"]["StroopInkUnserved"]
    return schema


@lru_cache(maxsize=2)
def payload_validator(allow_unserved: bool = False) -> Callable[[object], object]:
    # Draft-07 (what TS-to-JSON-Schema exporters emit), compiled to Python once: about 10x faster
    # than the interpreting jsonschema package on these payloads, which matters when BE-04 refills a
    # pool and when the tests sweep 1000 seeds per schema.
    return fastjsonschema.compile(_unserved_schema() if allow_unserved else load_schema())


def schema_problems(payload: object, *, allow_unserved: bool = False) -> list[str]:
    try:
        payload_validator(allow_unserved)(payload)
    except fastjsonschema.JsonSchemaValueException as e:
        return [e.message]
    return []


def validate_payload(payload: object, *, allow_unserved: bool = False) -> list[str]:
    """[] when the payload matches the schema and every answer survives its solver.

    allow_unserved=True also accepts content the UI cannot show yet (the cvd_safe Stroop inks).
    A server must call it with the default, False."""
    problems = schema_problems(payload, allow_unserved=allow_unserved)
    if problems:
        return problems
    return verify(payload)  # type: ignore[arg-type]
