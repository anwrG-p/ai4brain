"""Task families the Kalman observation mapping (digital_brain_updater) knows."""

from enum import Enum


class TaskType(str, Enum):
    INTERFERENCE_N_BACK = "INTERFERENCE_N_BACK"
    RELATIONAL_RESPONDING_RFT = "RELATIONAL_RESPONDING_RFT"
