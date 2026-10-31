"""The Python workspace: one root requirements file and one pytest run cover every package."""

import configparser
import importlib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ["ai_coach", "brain_twin_jepa", "clustering_engine", "dynamic_cache"]


@pytest.mark.parametrize("package", PACKAGES)
def test_package_importable(package):
    importlib.import_module(package)


def test_root_requirements_include_every_package():
    lines = (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
    included = {line.split(None, 1)[1] for line in lines if line.startswith("-r ")}
    expected = {"assessment_engine/api/requirements.txt"} | {
        f"{p}/requirements.txt" for p in PACKAGES
    }
    assert included == expected
    assert all((ROOT / path).is_file() for path in included)


def test_root_pytest_collects_every_suite():
    ini = configparser.ConfigParser()
    ini.read(ROOT / "pytest.ini", encoding="utf-8")
    testpaths = ini["pytest"]["testpaths"].split()
    assert {"tests", "assessment_engine/api/tests"} <= set(testpaths)
    assert all(f"{p}/tests" in testpaths for p in PACKAGES)
