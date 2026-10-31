"""Relative links in docs/ point at files that exist, and duplicated docs stay pointers (TD-06)."""

import re
from pathlib import Path
from urllib.parse import unquote

import pytest

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
# [text](target) and <img src="target">; skips URLs, mailto, in-page anchors and absolute file:/// links.
LINK = re.compile(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)|src=\"([^\"]+)\"")
EXTERNAL = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|#|/)", re.I)


def relative_links(md: Path):
    text = md.read_text(encoding="utf-8")
    # Code blocks and inline code hold examples, not links.
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"`[^`\n]*`", "", text)
    for match in LINK.finditer(text):
        target = match.group(1) or match.group(2)
        if not EXTERNAL.match(target):
            yield target


def broken_links(md: Path) -> list[str]:
    broken = []
    for target in relative_links(md):
        path = unquote(target.split("#", 1)[0].split("?", 1)[0])
        if path and not (md.parent / path).exists():
            broken.append(target)
    return broken


@pytest.mark.parametrize(
    "md", sorted(DOCS.rglob("*.md")), ids=lambda p: p.relative_to(DOCS).as_posix()
)
def test_relative_links_resolve(md):
    assert broken_links(md) == []


def test_ux_pipeline_is_an_index_only():
    files = [p.relative_to(DOCS).as_posix() for p in (DOCS / "ux-pipeline").rglob("*") if p.is_file()]
    assert files == ["ux-pipeline/README.md"]


@pytest.mark.parametrize(
    "pointer, canonical",
    [
        ("docs/TASKS_AND_DIMENSIONS.md", "architecture/TASKS_AND_DIMENSIONS.md"),
        ("GLOSSARY.md", "docs/GLOSSARY.md"),
    ],
)
def test_duplicates_are_pointers(pointer, canonical):
    text = (ROOT / pointer).read_text(encoding="utf-8")
    assert f"]({canonical})" in text
    assert len(text.splitlines()) <= 5


def test_no_links_to_another_machine():
    offenders = [
        md.relative_to(ROOT).as_posix()
        for md in [ROOT / "GLOSSARY.md", DOCS / "TASKS_AND_DIMENSIONS.md", DOCS / "README.md", *(DOCS / "ux-pipeline").rglob("*.md")]
        if "Users/Smida" in md.read_text(encoding="utf-8")
    ]
    assert offenders == []
