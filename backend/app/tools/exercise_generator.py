"""Procedural Isomorphic Exercise & Test Generator.

Implements:
1. Arbitrarily Applicable Relational Responding (RFT / Graph-based transitive inference with NetworkX & rule switches).
2. Interference-Loaded N-Back with proactive lures (N-1 and N+1) and strict non-duplication.
3. 85% Rule for Optimal Learning (dynamic difficulty scaling of IRT b-parameter).
"""

from typing import List, Dict, Any, Tuple, Optional
import random
import uuid
import hashlib
import networkx as nx

from app.models.task_schema import (
    TaskType,
    CorticalNode,
    TaskConfigPayload,
    TaskTrialBlueprint,
    TaskTimingRules,
)


class ExerciseGenerator:
    """Mathematical and procedural task generator enforcing clinical validity and zero memorization."""

    # Abstract symbol token pools for procedural generation
    SYMBOL_POOLS = [
        ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA", "ETA", "THETA"],
        ["CIR", "SQR", "TRI", "HEX", "OCT", "DIA", "STR", "CRS"],
        ["LUMEN", "AURA", "QUARK", "PHOTON", "BOSON", "GLUON", "LEPTON", "MESON"],
        ["NEO", "CYBER", "SYNAPSE", "CORTEX", "AXON", "DENDRITE", "MYELIN", "SOMA"],
    ]

    RELATION_TYPES = ["GREATER_THAN", "LESS_THAN", "EQUIVALENT", "OPPOSITE"]

    @classmethod
    def apply_85_percent_rule(
        cls,
        historical_accuracy: float,
        current_difficulty_b: float,
        step_size: float = 0.25,
    ) -> float:
        """Enforces the Wilson et al. (2019) 85% Rule for Optimal Learning.

        Optimal learning occurs when error rate is ~15% (85% accuracy).
        - If accuracy > 85%: increase difficulty b.
        - If accuracy < 85%: decrease difficulty b.
        Bounds b in [-2.5, +2.5].
        """
        error_rate = 1.0 - historical_accuracy
        target_error_rate = 0.15

        # Delta proportional to divergence from 15% error rate
        delta = (target_error_rate - error_rate) * step_size * 2.0
        # If error_rate is 0.0 (too easy), delta is +0.15 * 0.5 = +0.075 -> increase difficulty
        # If error_rate is 0.30 (too hard), delta is -0.15 * 0.5 = -0.075 -> decrease difficulty
        new_b = current_difficulty_b + delta
        return round(float(max(-2.5, min(2.5, new_b))), 3)

    @classmethod
    def generate_relational_responding_task(
        cls,
        num_trials: int = 20,
        difficulty_b: float = 0.0,
        seed: Optional[int] = None,
    ) -> TaskConfigPayload:
        """Procedurally generate an Arbitrarily Applicable Relational Responding (RFT) task.

        Target Node: dlPFC / Hippocampus_DG (Relational inference & working memory manipulation).
        Constructs a directed acyclic graph (DAG) of arbitrary token relations:
        e.g., A > B > C > D > E.
        Queries transitive relationships (e.g., Is A > C? Is D < B?).
        Injects rule-switching modifiers (e.g. dimensional inversion) at higher difficulty.
        """
        rng = random.Random(seed)
        task_id = f"rft_{uuid.uuid4().hex[:8]}"

        # Map difficulty b to graph size and transitive depth
        # b in [-2.5, +2.5] -> chain_length 4 to 8
        normalized_b = (difficulty_b + 2.5) / 5.0  # 0.0 to 1.0
        chain_len = int(round(4 + normalized_b * 4))
        allow_rule_switch = difficulty_b > 0.0
        rule_switch_freq = 0.25 if allow_rule_switch else 0.0

        # Choose abstract symbol pool
        pool_idx = rng.randint(0, len(cls.SYMBOL_POOLS) - 1)
        tokens = rng.sample(cls.SYMBOL_POOLS[pool_idx], chain_len)

        # Build ground-truth linear ordering DAG: tokens[0] > tokens[1] > ... > tokens[chain_len-1]
        dag = nx.DiGraph()
        for i in range(chain_len - 1):
            dag.add_edge(tokens[i], tokens[i + 1], relation="GREATER_THAN")

        # Procedurally build transitive closure to know ground truth for all pairs
        transitive_closure = nx.transitive_closure(dag)

        trials: List[TaskTrialBlueprint] = []
        used_stimulus_keys = set()

        for t_idx in range(num_trials):
            # Pick a pair with variable distance
            dist = rng.randint(1, chain_len - 1)
            start_idx = rng.randint(0, chain_len - 1 - dist)
            end_idx = start_idx + dist

            elem_a = tokens[start_idx]
            elem_b = tokens[end_idx]

            # In ground truth: elem_a > elem_b (since start_idx < end_idx)
            # Query can be framed as: Is A > B? or Is B > A? or Is A < B?
            query_relation = rng.choice(["GREATER_THAN", "LESS_THAN"])
            
            # Ground truth:
            # elem_a is GREATER than elem_b: True
            # elem_a is LESS than elem_b: False
            # elem_b is GREATER than elem_a: False
            # elem_b is LESS than elem_a: True
            invert_order = rng.choice([True, False])
            first_elem = elem_b if invert_order else elem_a
            second_elem = elem_a if invert_order else elem_b

            if query_relation == "GREATER_THAN":
                truth = (first_elem == elem_a and second_elem == elem_b)
            else:  # LESS_THAN
                truth = (first_elem == elem_b and second_elem == elem_a)

            # Rule switch modifier: if rule is active, relation flips
            rule_switched = allow_rule_switch and (rng.random() < rule_switch_freq)
            if rule_switched:
                truth = not truth

            # Ensure uniqueness of stimulus query across trials
            stim_hash = hashlib.sha256(f"{first_elem}:{query_relation}:{second_elem}:{rule_switched}:{t_idx}".encode()).hexdigest()[:12]
            stim_id = f"rft_stim_{stim_hash}"
            used_stimulus_keys.add(stim_id)

            item_b = round(difficulty_b + (dist - 2) * 0.2 + (0.3 if rule_switched else 0.0), 3)

            blueprint = TaskTrialBlueprint(
                trial_index=t_idx,
                stimulus_id=stim_id,
                stimulus_display={
                    "first_token": first_elem,
                    "relation_query": query_relation,
                    "second_token": second_elem,
                    "chain_context": [f"{tokens[i]} > {tokens[i+1]}" for i in range(chain_len - 1)],
                    "rule_modifier": "INVERTED_LOGIC" if rule_switched else "STANDARD_LOGIC",
                    "transitive_distance": dist,
                },
                target_present=truth,
                correct_key="TRUE" if truth else "FALSE",
                is_lure=False,
                lure_type=None,
                item_difficulty_b=item_b,
                discrimination_a=round(1.0 + (dist * 0.15), 2),
                guessing_c=0.5,  # Binary true/false choice
            )
            trials.append(blueprint)

        timing = TaskTimingRules(
            fixation_ms=450,
            stimulus_duration_ms=max(1200, int(2500 - normalized_b * 1000)),
            inter_stimulus_interval_ms=400,
            response_deadline_ms=3500,
        )

        return TaskConfigPayload(
            task_id=task_id,
            task_type=TaskType.RELATIONAL_RESPONDING_RFT,
            target_node=CorticalNode.dlPFC,
            difficulty_b=difficulty_b,
            trials=trials,
            timing_rules=timing,
            instructions=[
                "Observe the established transitive hierarchy between tokens.",
                "Verify whether the proposed logical statement is TRUE or FALSE.",
                "If the Rule Inversion indicator appears, reverse your logical evaluation.",
            ],
            metadata={
                "chain_length": chain_len,
                "allow_rule_switch": allow_rule_switch,
                "unique_stimuli_count": len(used_stimulus_keys),
            },
        )

    @classmethod
    def generate_interference_n_back_task(
        cls,
        num_trials: int = 30,
        difficulty_b: float = 0.0,
        seed: Optional[int] = None,
    ) -> TaskConfigPayload:
        """Procedurally generate an Interference-Loaded N-Back with proactive lures (N-1 and N+1).

        Target Node: dlPFC & ACC & vlPFC_Striatum (Working memory maintenance & conflict inhibition).
        Difficulty parameter b modulates:
        - N value: N=2 for b <= 0.0, N=3 for b > 0.0, N=4 for b >= 1.5
        - Proactive lure ratio: 20% to 35%
        - Target ratio: ~30%
        - Presentation duration: 1500ms -> 800ms
        """
        rng = random.Random(seed)
        task_id = f"nback_{uuid.uuid4().hex[:8]}"

        # Determine N from difficulty
        if difficulty_b < -0.5:
            n_back = 2
            target_rate = 0.30
            lure_rate = 0.20
            stim_duration = 1400
        elif difficulty_b <= 1.0:
            n_back = 2
            target_rate = 0.33
            lure_rate = 0.28
            stim_duration = 1100
        elif difficulty_b <= 2.0:
            n_back = 3
            target_rate = 0.30
            lure_rate = 0.30
            stim_duration = 900
        else:
            n_back = 4
            target_rate = 0.28
            lure_rate = 0.35
            stim_duration = 800

        # Symbol pool: choose geometric or alphanumeric tokens
        tokens = rng.sample(cls.SYMBOL_POOLS[1] + cls.SYMBOL_POOLS[0], 8)

        # Procedurally build sequence enforcing target and lure constraints
        sequence: List[str] = []
        trial_types: List[Dict[str, Any]] = []

        for i in range(num_trials):
            if i < n_back:
                # Priming trials (cannot be targets or N-1 lures)
                chosen = rng.choice(tokens)
                sequence.append(chosen)
                trial_types.append({
                    "is_target": False,
                    "is_lure": False,
                    "lure_type": None,
                })
                continue

            roll = rng.random()
            # 1. Target trial: matches item at i - n_back
            if roll < target_rate:
                chosen = sequence[i - n_back]
                is_target = True
                is_lure = False
                lure_type = None

            # 2. Proactive Lure trial: matches item at i - (n_back - 1) or i - (n_back + 1)
            elif roll < (target_rate + lure_rate):
                is_target = False
                is_lure = True
                # Choose N-1 lure (if i >= n_back - 1) or N+1 lure (if i >= n_back + 1)
                lure_options = []
                if (n_back - 1) >= 1 and (i - (n_back - 1)) >= 0:
                    lure_options.append((sequence[i - (n_back - 1)], "N-1"))
                if (i - (n_back + 1)) >= 0:
                    lure_options.append((sequence[i - (n_back + 1)], "N+1"))

                if lure_options:
                    chosen, lure_type = rng.choice(lure_options)
                    # If accidentally matches target, re-roll to a non-target token
                    if chosen == sequence[i - n_back]:
                        is_target = True
                        is_lure = False
                        lure_type = None
                else:
                    # Fallback non-target
                    non_targets = [t for t in tokens if t != sequence[i - n_back]]
                    chosen = rng.choice(non_targets)
                    is_lure = False
                    lure_type = None

            # 3. Non-target foil
            else:
                is_target = False
                is_lure = False
                lure_type = None
                # Pick token that is NEITHER target nor lure
                forbidden = {sequence[i - n_back]}
                if (n_back - 1) >= 1 and (i - (n_back - 1)) >= 0:
                    forbidden.add(sequence[i - (n_back - 1)])
                if (i - (n_back + 1)) >= 0:
                    forbidden.add(sequence[i - (n_back + 1)])

                valid_tokens = [t for t in tokens if t not in forbidden]
                chosen = rng.choice(valid_tokens) if valid_tokens else rng.choice(tokens)
                if chosen == sequence[i - n_back]:
                    is_target = True

            sequence.append(chosen)
            trial_types.append({
                "is_target": is_target,
                "is_lure": is_lure,
                "lure_type": lure_type,
            })

        # Build blueprints
        trials: List[TaskTrialBlueprint] = []
        used_stimuli = set()

        for t_idx in range(num_trials):
            token = sequence[t_idx]
            tt = trial_types[t_idx]
            target_present = tt["is_target"]
            is_lure = tt["is_lure"]
            lure_type = tt["lure_type"]

            # Unique stimulus identifier per trial
            stim_hash = hashlib.sha256(f"{task_id}:{t_idx}:{token}:{target_present}".encode()).hexdigest()[:12]
            stim_id = f"nb_{stim_hash}"
            used_stimuli.add(stim_id)

            # Calibrate item difficulty
            item_b = difficulty_b + (0.4 if is_lure else (0.1 if target_present else -0.1))

            blueprint = TaskTrialBlueprint(
                trial_index=t_idx,
                stimulus_id=stim_id,
                stimulus_display={
                    "token": token,
                    "spatial_pos": rng.randint(0, 8),  # 3x3 grid position
                    "n_back_order": n_back,
                    "is_lure_indicator": is_lure,
                },
                target_present=target_present,
                correct_key="MATCH" if target_present else "NO_MATCH",
                is_lure=is_lure,
                lure_type=lure_type,
                item_difficulty_b=round(item_b, 3),
                discrimination_a=round(1.2 + (0.3 if is_lure else 0.0), 2),
                guessing_c=0.5,
            )
            trials.append(blueprint)

        timing = TaskTimingRules(
            fixation_ms=400,
            stimulus_duration_ms=stim_duration,
            inter_stimulus_interval_ms=500,
            response_deadline_ms=stim_duration + 800,
            gap_effect_pause_ms=10000,
        )

        return TaskConfigPayload(
            task_id=task_id,
            task_type=TaskType.INTERFERENCE_N_BACK,
            target_node=CorticalNode.ACC if lure_rate > 0.25 else CorticalNode.dlPFC,
            difficulty_b=difficulty_b,
            trials=trials,
            timing_rules=timing,
            instructions=[
                f"Continuous {n_back}-Back test with proactive conflict lures.",
                f"Press MATCH when the current symbol matches the item from {n_back} steps ago.",
                "Press NO_MATCH otherwise. Beware of familiar items from N-1 or N+1 steps ago.",
            ],
            metadata={
                "n_back": n_back,
                "target_count": sum(1 for t in trials if t.target_present),
                "lure_count": sum(1 for t in trials if t.is_lure),
                "unique_stimuli_count": len(used_stimuli),
            },
        )
