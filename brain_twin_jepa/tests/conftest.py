import time

import pytest

from brain_twin_jepa.train import TrainConfig, fit

# The small twin the suite shares: the default architecture, fewer users and steps than the full
# run (python -m brain_twin_jepa.train). About 10 s on a laptop CPU.
SMALL = TrainConfig(users=400, sessions=12, data_seed=0, seed=0, steps=400, log_every=50)


@pytest.fixture(scope="session")
def trained():
    t = time.perf_counter()
    twin, report = fit(SMALL)
    return twin, report, time.perf_counter() - t
