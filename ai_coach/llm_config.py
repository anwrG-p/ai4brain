"""Unified LLM configuration resolver supporting Gemini and OpenRouter."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Optional, Tuple

from ai_coach.llm_gemini import config_from_env as gemini_config_from_env
from ai_coach.llm_openrouter import clean_env_val, config_from_env as openrouter_config_from_env


def active_llm_config(
    environ: Optional[Mapping[str, str]] = None,
) -> Optional[Tuple[str, str, str]]:
    """Resolve the active LLM provider configuration: (provider, api_key, model).

    Supported providers:
      - 'openrouter' via OPENROUTER_API_KEY (and OPENROUTER_MODEL)
      - 'gemini' via GEMINI_API_KEY (and GEMINI_MODEL)

    Selection rules:
      1. If LLM_PROVIDER is explicitly set ('openrouter' or 'gemini'), it must match.
      2. If LLM_PROVIDER is unset:
         - If only OPENROUTER_API_KEY is present -> 'openrouter'
         - If GEMINI_API_KEY is present -> 'gemini' (backward compatible default)
         - If neither is present -> None
    """
    env = os.environ if environ is None else environ
    pref = clean_env_val(env.get("LLM_PROVIDER")).lower()

    openrouter_cfg = openrouter_config_from_env(env)
    gemini_cfg = gemini_config_from_env(env)

    if pref == "openrouter":
        return ("openrouter", *openrouter_cfg) if openrouter_cfg else None
    if pref == "gemini":
        return ("gemini", *gemini_cfg) if gemini_cfg else None

    # Auto-detection
    if openrouter_cfg and not gemini_cfg:
        return ("openrouter", *openrouter_cfg)
    if gemini_cfg:
        return ("gemini", *gemini_cfg)
    if openrouter_cfg:
        return ("openrouter", *openrouter_cfg)
    return None
