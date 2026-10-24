"""Unit and integration tests for dynamic clusters and extensible cognitive dimensions."""

import numpy as np
import pytest

from clustering_engine.archetypes import Archetype, ArchetypeRegistry, format_dimension_phrase
from clustering_engine.evaluator import CognitiveEvaluator
from clustering_engine.explainability import ExplainabilityDecoder, validate_non_clinical
from clustering_engine.gmm_clusterer import SoftGMMClusterer


class TestExtensibleDimensions:
    """Test suite verifying support for arbitrary cognitive evaluation dimensions."""

    def test_classic_four_dimensions(self):
        """Test evaluator configured with README 4 dimensions."""
        dims_4 = (
            "working_memory",
            "pattern_induction",
            "executive_function",
            "spatial_orientation",
        )
        evaluator = CognitiveEvaluator(dim=64, k=4, dimensions=dims_4)
        res = evaluator.evaluate("usr_4dim", np.random.randn(64))
        data = res.to_dict()

        assert len(data["radar_scores"]) == 4
        assert set(data["radar_scores"].keys()) == set(dims_4)
        assert len(data["cluster_probabilities"]) == 4

    def test_member1_handover_six_dimensions(self):
        """Test evaluator configured with Member 1 handover's 6 dimensions."""
        dims_6 = (
            "working_memory",
            "pattern_induction",
            "executive_function",
            "spatial_orientation",
            "processing_speed",
            "episodic_memory",
        )
        evaluator = CognitiveEvaluator(dim=64, k=6, dimensions=dims_6)
        res = evaluator.evaluate("usr_6dim", np.random.randn(64))
        data = res.to_dict()

        assert len(data["radar_scores"]) == 6
        assert set(data["radar_scores"].keys()) == set(dims_6)
        assert len(data["cluster_probabilities"]) == 6

    def test_custom_domain_dimensions(self):
        """Test evaluator configured with completely custom domain dimensions."""
        custom_dims = ("verbal_fluency", "divided_attention", "cognitive_flexibility")
        evaluator = CognitiveEvaluator(dim=64, k=3, dimensions=custom_dims)
        res = evaluator.evaluate("usr_custom", np.random.randn(64))
        data = res.to_dict()

        assert len(data["radar_scores"]) == 3
        assert set(data["radar_scores"].keys()) == set(custom_dims)

    def test_dimension_phrase_formatting(self):
        """Test human-readable formatting of various dimension names."""
        assert format_dimension_phrase("working_memory") == "working memory stability"
        assert format_dimension_phrase("episodic_memory") == "episodic memory recall"
        assert format_dimension_phrase("executive_function") == "executive cognitive control"
        assert format_dimension_phrase("custom_dimension") == "custom dimension"


class TestDynamicClusterCounts:
    """Test suite verifying support for arbitrary cluster count K."""

    @pytest.mark.parametrize("k", [2, 3, 5, 8, 12])
    def test_gmm_clusterer_arbitrary_k(self, k: int):
        clusterer = SoftGMMClusterer(dim=64, k=k)
        assert clusterer.k == k
        assert len(clusterer.cluster_codes) == k

        probs = clusterer.compute_responsibilities(np.random.randn(64))
        assert len(probs) == k
        assert abs(sum(probs.values()) - 1.0) <= 1e-5
        for code, p in probs.items():
            assert 0.0 <= p <= 1.0

    def test_dynamic_gmm_fitting_with_new_k(self):
        """Test fitting from data and changing K dynamically."""
        clusterer = SoftGMMClusterer(dim=64, k=3)
        rng = np.random.RandomState(42)
        samples = rng.randn(50, 64)

        # Fit with k=5
        clusterer.fit(samples, k=5, max_iter=20)
        assert clusterer.k == 5
        probs = clusterer.compute_responsibilities(np.random.randn(64))
        assert len(probs) == 5
        assert abs(sum(probs.values()) - 1.0) <= 1e-5

    def test_evaluator_transition_with_dynamic_k(self):
        """Test dwell-time transition gate and explainability with custom K=3."""
        dims = ("working_memory", "processing_speed", "spatial_reasoning")
        evaluator = CognitiveEvaluator(dim=64, k=3, dimensions=dims, eta=1.0, delta_hyst=0.15, n_confirm=3)

        c1 = evaluator.clusterer.get_centroid(1)
        c2 = evaluator.clusterer.get_centroid(2)

        # Init at cluster 1
        evaluator.evaluate("usr_k3", c1)

        # Feed cluster 2 for 3 frames
        evaluator.evaluate("usr_k3", c2)
        evaluator.evaluate("usr_k3", c2)
        res = evaluator.evaluate("usr_k3", c2)

        assert res.has_transitioned is True
        assert res.active_cluster_id == 2
        assert res.transition_event is not None
        assert res.transition_event.from_cluster == 1
        assert res.transition_event.to_cluster == 2
        assert len(res.transition_event.delta_vector) == 3
        assert res.transition_event.dominant_driver in dims
        validate_non_clinical(res.transition_event.xai_explanation)


class TestArchetypeRegistry:
    """Test suite for ArchetypeRegistry management."""

    def test_custom_registry_registration(self):
        registry = ArchetypeRegistry()
        custom_arch = Archetype(
            id=1,
            code="C1",
            name="Focused Strategist",
            proficiency_tier="Advanced",
            pacing_strategy="Dynamic",
            description="High strategic synthesis.",
            growth_focus="Expanding multi-tasking.",
            target_radar={"working_memory": 85.0, "processing_speed": 90.0},
        )
        registry.register(custom_arch)

        assert len(registry) == 1
        retrieved = registry.get(1)
        assert retrieved.name == "Focused Strategist"
        assert registry.get_by_code("C1").id == 1

    def test_generate_for_k(self):
        dims = ["working_memory", "executive_function"]
        registry = ArchetypeRegistry.generate_for_k(k=5, dimensions=dims)
        assert len(registry) == 5
        for i in range(1, 6):
            arch = registry.get(i)
            assert arch.id == i
            assert arch.code == f"C{i}"
            assert set(arch.target_radar.keys()) == set(dims)

    def test_save_and_load_registry_dict(self):
        dims = ["working_memory", "processing_speed"]
        original = ArchetypeRegistry.generate_for_k(k=4, dimensions=dims)
        data = original.to_dict()

        restored = ArchetypeRegistry.load_from_dict(data, dimensions=dims)
        assert len(restored) == 4
        for i in range(1, 5):
            assert restored.get(i).name == original.get(i).name
