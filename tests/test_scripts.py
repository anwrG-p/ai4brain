"""Root Node scripts fail with a usage line instead of a stack trace (TD-02)."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")


def run(script: Path, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [NODE, str(script), *args],
        capture_output=True,
        text=True,
        timeout=30,
        env={**os.environ, **(env or {})},
    )


def isolated_copy(tmp_path: Path, name: str) -> Path:
    """The script alone under <tmp>/scripts/, so <tmp> plays an empty repo root."""
    (tmp_path / "scripts").mkdir()
    return Path(shutil.copy(ROOT / "scripts" / name, tmp_path / "scripts" / name))


def assert_usage_error(result: subprocess.CompletedProcess, *needles: str) -> None:
    assert result.returncode != 0
    assert "Usage:" in result.stderr
    for needle in needles:
        assert needle in result.stderr
    assert "    at " not in result.stderr  # no stack trace


def test_download_stitch_without_args_prints_usage():
    assert_usage_error(run(ROOT / "scripts" / "download_stitch.mjs", env={"STITCH_API_KEY": "k"}))


def test_download_stitch_without_key_prints_usage(tmp_path):
    screens = tmp_path / "screens.json"
    screens.write_text('{"screens": []}', encoding="utf-8")
    result = run(ROOT / "scripts" / "download_stitch.mjs", str(screens), env={"STITCH_API_KEY": ""})
    assert_usage_error(result, "STITCH_API_KEY")


def test_download_stitch_missing_screens_file_prints_usage(tmp_path):
    result = run(
        ROOT / "scripts" / "download_stitch.mjs",
        str(tmp_path / "missing.json"),
        env={"STITCH_API_KEY": "k"},
    )
    assert_usage_error(result, "missing.json")


def test_download_stitch_reads_no_hardcoded_machine_path():
    source = (ROOT / "scripts" / "download_stitch.mjs").read_text(encoding="utf-8")
    assert "C:/Users" not in source and "C:\\\\Users" not in source


def test_render_diagrams_names_missing_frontend_dependency(tmp_path):
    result = run(isolated_copy(tmp_path, "parse_and_render_diagrams.mjs"))
    assert_usage_error(result, "frontend", "npm ci")


def test_render_diagrams_pins_mermaid_version():
    source = (ROOT / "scripts" / "parse_and_render_diagrams.mjs").read_text(encoding="utf-8")
    assert "mermaid@11/" not in source
    assert "mermaid@11." in source


@pytest.mark.parametrize("name", ["build_html_viewer.mjs", "update_sequence_diagrams_md.mjs"])
def test_diagram_doc_scripts_name_missing_input(tmp_path, name):
    assert_usage_error(run(isolated_copy(tmp_path, name)), "SEQUENCE_DIAGRAMS.md")
