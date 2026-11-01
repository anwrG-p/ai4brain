"""The JSON Schema mirrors frontend/src/features/assessment/telemetry/types.ts and is enforced."""

from __future__ import annotations

import copy
import json
import re
from functools import lru_cache
from pathlib import Path

import pytest

from dynamic_cache.generators import SCHEMA_TYPES, generate, schema_problems, validate_payload
from dynamic_cache.generators.validate import load_schema

ROOT = Path(__file__).resolve().parents[2]
TASKS = ROOT / "frontend" / "src" / "features" / "assessment"
# The frontend is not part of an installed package or a backend-only checkout: skip, don't fail.
requires_frontend = pytest.mark.skipif(
    not (TASKS / "telemetry" / "types.ts").is_file(), reason="frontend/ is not present"
)
SCHEMA = load_schema()


@lru_cache(maxsize=1)
def types_ts() -> str:
    return (TASKS / "telemetry" / "types.ts").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def fixtures() -> dict:
    data = json.loads((TASKS / "tasks" / "fixtures.json").read_text(encoding="utf-8"))
    return {f["schema_type"]: f for f in data}

# TS type -> schema definition (None = the schema root)
TS_TO_SCHEMA = {
    "TaskPayload": None,
    "Glyph": "Glyph",
    "Poly": "Poly",
    "Statement": "Statement",
    "NBackParams": "NBackParams",
    "StroopParams": "StroopParams",
    "MatrixParams": "MatrixParams",
    "RotationParams": "RotationParams",
    "RelationalParams": "RelationalParams",
    "TowerParams": "TowerParams",
    "UfovParams": "UfovParams",
    "MstParams": "MstParams",
    "StopSignalParams": "StopSignalParams",
    "PalParams": "PalParams",
    "FlankerParams": "FlankerParams",
}


# ---- a small reader for the object types in types.ts --------------------------------------------


def _match(src: str, i: int) -> int:
    """Index just past the bracket that closes the one at src[i]."""
    pairs = {"{": "}", "[": "]", "(": ")"}
    stack = [pairs[src[i]]]
    j = i + 1
    while stack:
        c = src[j]
        if c in pairs:
            stack.append(pairs[c])
        elif c == stack[-1]:
            stack.pop()
        j += 1
    return j


def _fields(body: str) -> dict:
    """{key: (optional, nested fields or None, array depth)} for one object type's body."""
    out, i = {}, 0
    key_re = re.compile(r"\s*(\w+)(\?)?\s*:\s*")
    while True:
        while i < len(body) and body[i] in " \n\r\t;,":
            i += 1
        if i >= len(body):
            return out
        m = key_re.match(body, i)
        assert m, f"cannot read a field at: {body[i:i + 40]!r}"
        key, optional, i = m.group(1), bool(m.group(2)), m.end()
        start = i
        while i < len(body) and body[i] not in "\n;,":
            i = _match(body, i) if body[i] in "{[(" else i + 1
        expr = body[start:i].strip()
        nested = depth = None
        if expr.startswith("{"):
            end = _match(expr, 0)
            nested = _fields(expr[1 : end - 1])
            depth = expr[end:].count("[]")
        out[key] = (optional, nested, depth)


def ts_object(name: str) -> dict:
    src = types_ts()
    m = re.search(rf"export type {name} = \{{", src)
    assert m, f"type {name} not found in types.ts"
    open_at = m.end() - 1
    body = src[open_at + 1 : _match(src, open_at) - 1]
    return _fields(re.sub(r"//[^\n]*", "", body))


def _resolve(node: dict) -> dict:
    while "$ref" in node:
        node = SCHEMA["definitions"][node["$ref"].split("/")[-1]]
    branches = [b for b in node.get("anyOf", []) if b.get("type") != "null"]
    return _resolve(branches[0]) if len(branches) == 1 else node


def _compare(ts: dict, node: dict, where: str) -> list[str]:
    node = _resolve(node)
    props = node.get("properties", {})
    out = []
    if set(props) != set(ts):
        out.append(f"{where}: schema keys {sorted(props)} != types.ts keys {sorted(ts)}")
    required = set(node.get("required", []))
    want = {k for k, (opt, _, _) in ts.items() if not opt}
    if required != want:
        out.append(f"{where}: schema required {sorted(required)} != types.ts required {sorted(want)}")
    for key, (_, nested, depth) in ts.items():
        if nested is None or key not in props:
            continue
        sub = _resolve(props[key])
        for _ in range(depth):
            sub = _resolve(sub["items"])
        out += _compare(nested, sub, f"{where}.{key}")
    return out


@requires_frontend
@pytest.mark.parametrize("ts_name", sorted(TS_TO_SCHEMA))
def test_schema_matches_types_ts(ts_name):
    definition = TS_TO_SCHEMA[ts_name]
    node = SCHEMA if definition is None else SCHEMA["definitions"][definition]
    assert _compare(ts_object(ts_name), node, ts_name) == []


@requires_frontend
def test_reader_sees_nested_trial_shapes():
    # guards the reader itself: a nested object type and an optional key are both picked up
    nback = ts_object("NBackParams")
    _, trial, depth = nback["trials"]
    assert depth == 1 and set(trial) == {"pos", "symbol", "rule", "trial_type", "answer"}
    assert trial["answer"][1] == {"position": (True, None, None), "symbol": (True, None, None)}
    assert ts_object("TowerParams")["time_limit_ms"][0] is True


@requires_frontend
def test_drift_is_caught():
    tower = copy.deepcopy(SCHEMA["definitions"]["TowerParams"])
    tower["properties"].pop("time_limit_ms")
    assert _compare(ts_object("TowerParams"), tower, "TowerParams")
    nback = copy.deepcopy(SCHEMA["definitions"]["NBackParams"])
    nback["properties"]["trials"]["items"]["required"].remove("answer")
    assert _compare(ts_object("NBackParams"), nback, "NBackParams")


@requires_frontend
def test_enums_match_the_frontend():
    dims = re.search(r"export type Dimension =([^/]*?)\n\n", types_ts(), re.S).group(1)
    assert set(re.findall(r"'(\w+)'", dims)) == set(SCHEMA["properties"]["dimension"]["enum"])
    # The app's one schema union (types/index.ts TaskSchemaType, F-B added the last three).
    union = (ROOT / "frontend" / "src" / "types" / "index.ts").read_text(encoding="utf-8")
    literals = re.search(r"export type TaskSchemaType =([^/]*?)\n\n", union, re.S).group(1)
    assert re.findall(r"'(\w+)'", literals) == list(SCHEMA_TYPES) == SCHEMA["properties"]["schema_type"]["enum"]
    # taskSource.ts validTask's own list must stay within it (it still lacks F-B's three: SRV-1
    # report, Requests; test_tasks_api pins the gap).
    source = (TASKS / "tasks" / "taskSource.ts").read_text(encoding="utf-8")
    listed = re.search(r"const SCHEMA_TYPES: readonly SchemaType\[\] = \[([^\]]*)\]", source).group(1)
    assert set(re.findall(r"'(\w+)'", listed)) <= set(SCHEMA_TYPES)


@requires_frontend
def test_stroop_inks_are_the_ones_stroop_tsx_paints():
    src = (TASKS / "tasks" / "Stroop.tsx").read_text(encoding="utf-8")
    ink_map = re.search(r"const INK[^=]*=\s*\{([^}]*)\}", src, re.S).group(1)
    painted = set(re.findall(r"^\s*(\w+):", ink_map, re.M))
    assert set(SCHEMA["definitions"]["StroopInk"]["enum"]) == painted


@requires_frontend
@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_frontend_fixtures_pass_the_schema(schema_type):
    # the schema is no stricter than what the UI already plays
    assert schema_problems(fixtures()[schema_type]) == []


def test_schema_is_package_data():
    # loaded through importlib.resources, so an installed wheel finds it without the repo
    assert SCHEMA["title"] == "TaskPayload" and "StroopParams" in SCHEMA["definitions"]


# ---- Stroop inks: both presets are served ---------------------------------------------------------


def test_served_schema_takes_both_ink_presets():
    assert SCHEMA["definitions"]["StroopInk"]["enum"] == ["red", "green", "blue", "yellow", "black"]
    assert "StroopInkUnserved" not in SCHEMA["definitions"]
    p = generate("stroop", 0.5, 3, inks="cvd_safe")
    assert schema_problems(p) == [] and validate_payload(p) == []
    p = copy.deepcopy(p)
    p["params"]["trials"][0]["ink"] = "purple"
    assert schema_problems(p)


# ---- the schema rejects what the client would choke on -------------------------------------------


def _broken(schema_type: str, edit) -> dict:
    p = copy.deepcopy(generate(schema_type, 0.5, 3))
    edit(p)
    return p


BROKEN = {
    "task_id too long": ("stroop", lambda p: p.update(task_id="x" * 49)),
    "task_id bad char": ("stroop", lambda p: p.update(task_id="a/b")),
    "unknown dimension": ("stroop", lambda p: p.update(dimension="memory")),
    "wrong dimension for schema": ("stroop", lambda p: p.update(dimension="working_memory")),
    "extra envelope field": ("tower", lambda p: p.update(extra=1)),
    "stroop ink the UI cannot paint": ("stroop", lambda p: p["params"]["trials"][0].update(ink="purple")),
    "matrix with no empty cell": ("matrix", lambda p: p["params"]["cells"].__setitem__(8, p["params"]["options"][0])),
    "matrix glyph colour unmapped": ("matrix", lambda p: p["params"]["options"][0].update(color="teal")),
    "n_back pos off the grid": ("n_back", lambda p: p["params"]["trials"][0].update(pos=[3, 0])),
    "ufov direction 8": ("ufov", lambda p: p["params"]["trials"][0].update(peripheral_dir=8)),
    "ufov similarity > 1": ("ufov", lambda p: p["params"].update(similarity=1.5)),
    "ufov empty grid": ("ufov", lambda p: p["params"].update(duration_grid_ms=[])),
    "tower missing goal": ("tower", lambda p: p["params"].pop("goal")),
    "rotation answer word": ("mental_rotation", lambda p: p["params"]["trials"][0].update(answer="yes")),
    "relational token not a word": ("relational", lambda p: p["params"]["levels"][0][0]["question"].update(a="<b>")),
    "mst unknown kind": ("mst", lambda p: p["params"]["test"][0].update(kind="maybe")),
    "params field typo": ("mst", lambda p: p["params"].update(encode_ms_=1)),
    "stop_signal dir up": ("stop_signal", lambda p: p["params"]["trials"][0].update(dir="up")),
    "stop_signal stop not a bool": ("stop_signal", lambda p: p["params"]["trials"][0].update(stop=1)),
    "stop_signal negative ssd": ("stop_signal", lambda p: p["params"].update(ssd_start_ms=-50)),
    "stop_signal wrong dimension": ("stop_signal", lambda p: p.update(dimension="episodic_memory")),
    "pal pattern 8 has no shape": ("pal", lambda p: p["params"]["stages"][0]["items"][0].update(pattern=8)),
    "pal 9 boxes": ("pal", lambda p: p["params"].update(boxes=9)),
    "pal recall missing": ("pal", lambda p: p["params"]["stages"][0].pop("recall")),
    "flanker congruent word": ("flanker", lambda p: p["params"]["trials"][0].update(congruent="yes")),
    "flanker missing fixation": ("flanker", lambda p: p["params"].pop("fixation_ms")),
}


@pytest.mark.parametrize("case", sorted(BROKEN))
def test_schema_rejects(case):
    schema_type, edit = BROKEN[case]
    assert schema_problems(_broken(schema_type, edit)), case
