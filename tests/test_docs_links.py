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


TEXT_SUFFIXES = {".md", ".html", ".svg", ".txt", ".json", ".py"}


def test_no_links_to_another_machine():
    """A file:/// link points at one person's disk, so it is broken for everyone else."""
    docs_text = [p for p in DOCS.rglob("*") if p.is_file() and p.suffix.lower() in TEXT_SUFFIXES]
    offenders = [
        f"{p.relative_to(ROOT).as_posix()}:{n}"
        for p in [ROOT / "README.md", ROOT / "GLOSSARY.md", *docs_text]
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1)
        if "file:///" in line.lower()
    ]
    assert offenders == []
