"""Optional `backend/.env` file (gitignored; template: backend/.env.example).

`load_env_file()` runs once when app.main is imported. The file is never required, and a real
environment variable always wins over the file. Values are never logged.
"""

import os
from collections.abc import MutableMapping
from pathlib import Path

from dotenv import dotenv_values

# app/ -> backend/
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def load_env_file(
    path: Path = ENV_FILE, environ: MutableMapping[str, str] | None = None
) -> list[str]:
    """Copy the file's variables into `environ` (os.environ by default) where not already set.

    Returns the names it set (never the values). A missing file sets nothing.
    """
    env = os.environ if environ is None else environ
    if not path.is_file():
        return []
    added = []
    for name, value in dotenv_values(path).items():
        if value is not None and name not in env:
            env[name] = value
            added.append(name)
    return added
