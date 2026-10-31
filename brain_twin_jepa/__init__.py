"""Brain Twin SAT-JEPA representation module and clustering bridge."""

from brain_twin_jepa.clustering_bridge import BrainTwinClusteringBridge
from brain_twin_jepa.encoder import TemporalContextEncoder
from brain_twin_jepa.featurizer import TelemetryFeaturizer
from brain_twin_jepa.predictor import LatentPredictor
from brain_twin_jepa.sat_jepa import SATJEPAModel
from brain_twin_jepa.synthetic_trainer import generate_synthetic_session, train_sat_jepa
from brain_twin_jepa.target_encoder import TargetEncoder

__all__ = [
    "BrainTwinClusteringBridge",
    "SATJEPAModel",
    "TelemetryFeaturizer",
    "TemporalContextEncoder",
    "TargetEncoder",
    "LatentPredictor",
    "generate_synthetic_session",
    "train_sat_jepa",
]
