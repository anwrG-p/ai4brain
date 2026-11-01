import time

import pytest


@pytest.fixture(scope="session")
def trained():
    """The small twin the suite shares: the default architecture, fewer users and steps than the
    full run (python -m brain_twin_jepa.train). About 10 s on a laptop CPU. Imported lazily, so a
    workspace without torch skips the twin's tests instead of failing collection."""
    pytest.importorskip("torch")
    from brain_twin_jepa.train import TrainConfig, fit

    t = time.perf_counter()
    twin, report = fit(TrainConfig(users=400, sessions=12, data_seed=0, seed=0, steps=400, log_every=50))
    return twin, report, time.perf_counter() - t
