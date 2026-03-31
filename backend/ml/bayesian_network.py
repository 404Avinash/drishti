"""
Bayesian Network for Real-Time Risk Propagation

Models Indian Railways as a probabilistic graphical model.
Updates beliefs every 5 minutes as NTES data arrives.

This answers: P(accident | current observations) = ?
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging
import json

logger = logging.getLogger(__name__)


@dataclass
class BayesianPrediction:
    """Result of Bayesian inference"""
    p_accident: float  # Probability of accident (0-1)
    p_collision: float  # Component: collision risk
    p_derailment: float  # Component: derailment risk
    confidence: float  # Confidence interval (0-1)
    time_to_accident_minutes: int  # If accident likely, when?


class BayesianRiskNetwork:
    """Real-time Bayesian inference for accident risk"""
    
    def __init__(self, causal_dag, prior_base_rate: float = 0.001):
        """
        Initialize Bayesian network.
        
        Args:
            causal_dag: CausalDAGBuilder with manual DAG
            prior_base_rate: P(accident) before any evidence (~0.1%)
        """
        self.causal_dag = causal_dag
        self.prior = prior_base_rate
        self.update_count = 0
        
        logger.info(f"Initialized Bayesian network with prior={prior_base_rate}")
    
    def update_belief(self, observations: Dict) -> BayesianPrediction:
        """
        Update beliefs given new evidence.
        
        Called every 5 minutes when NTES updates arrive.
        
        Args:
            observations: {
                'maintenance_active': bool,
                'delay_minutes': int,
                'signal_cycle_time': float,
                'traffic_density': float (0-1),
                'time_of_day': 'NIGHT' or 'DAY',
                'centrality_rank': int (0-100),
                'trains_bunching': bool,
                'is_goods_train': bool,
            }
            
        Returns:
            BayesianPrediction with P(accident | observations)
        """
        self.update_count += 1
        
        try:
            # Convert observations to causal state
            causal_state = self._observations_to_causal_state(observations)
            
            # Compute P(accident | state) from causal DAG
            p_accident = self.causal_dag.estimate_p_accident_given_state(causal_state)
            
            # Decompose into specific accident types
            p_collision = p_accident * 0.7  # 70% of accidents are collisions
            p_derailment = p_accident * 0.3  # 30% are derailments
            
            # Confidence: higher when evidence is strong/clear
            confidence = self._compute_confidence(causal_state)
            
            # Estimate time to accident: delays compound over next 30-60 min
            time_to_accident = self._estimate_time_to_accident(observations)
            
            prediction = BayesianPrediction(
                p_accident=p_accident,
                p_collision=p_collision,
                p_derailment=p_derailment,
                confidence=confidence,
                time_to_accident_minutes=time_to_accident
            )
            
            logger.debug(f"Update #{self.update_count}: P(accident)={p_accident:.3f}, confidence={confidence:.2f}")
            
            return prediction
            
        except Exception as e:
            logger.error(f"Bayesian update failed: {e}")
            # Return neutral prediction on error
            return BayesianPrediction(
                p_accident=self.prior,
                p_collision=self.prior * 0.7,
                p_derailment=self.prior * 0.3,
                confidence=0.0,
                time_to_accident_minutes=0
            )
    
    def _observations_to_causal_state(self, obs: Dict) -> Dict:
        """
        Convert numerical observations to discrete causal state.
        
        Discretization thresholds based on accident patterns.
        """
        
        state = {}
        
        # Maintenance window
        state['maintenance_skip'] = obs.get('maintenance_active', False)
        
        # Signal issues (proxied by cycle time anomalies)
        signal_cycle_time = obs.get('signal_cycle_time', 4.0)
        state['signal_failure'] = signal_cycle_time > 6.0  # >6s is anomalous
        
        # Delay cascade (>30 min delay is significant)
        delay = obs.get('delay_minutes', 0)
        state['delay_cascade'] = delay > 30
        
        # Train bunching (high traffic density at junction)
        traffic_density = obs.get('traffic_density', 0.0)
        state['train_bunching'] = traffic_density > 0.7
        
        # High-centrality junction (significant risk structural factor)
        centrality_rank = obs.get('centrality_rank', 50)
        state['high_centrality_junction'] = centrality_rank > 75
        
        # Night shift (22:00-05:00)
        state['night_shift'] = obs.get('time_of_day', '') == 'NIGHT'
        
        # Track mismatch: infer from maintenance + signal failure + delay
        state['track_mismatch'] = (
            state['maintenance_skip'] and 
            state['signal_failure']
        )
        
        return state
    
    def _compute_confidence(self, causal_state: Dict) -> float:
        """
        Compute confidence in the prediction.
        
        Higher when:
        1. Multiple independent factors agree (consensus)
        2. Evidence is unambiguous (clear on/off values)
        """
        # Count how many causal factors are "on"
        active_factors = sum(1 for v in causal_state.values() if v)
        max_factors = len(causal_state)
        
        # Consensus score: how much agreement?
        consensus = active_factors / max(max_factors, 1)
        
        # Confidence: higher when consensus is strong
        # (many factors aligned) or weak (mostly off)
        confidence = max(consensus, 1.0 - consensus)
        
        return confidence
    
    def _estimate_time_to_accident(self, obs: Dict) -> int:
        """
        Estimate minutes until potential accident.
        
        Based on:
        - Distance to next high-centrality junction
        - Current delay trend
        - Traffic bunching rate
        """
        
        # Default: no accident expected
        time_to_accident = 120  # 2 hours default
        
        delay = obs.get('delay_minutes', 0)
        traffic_density = obs.get('traffic_density', 0.0)
        
        # If high traffic density + high delay → quick convergence
        if traffic_density > 0.8 and delay > 40:
            time_to_accident = 15  # 15 min to collision
        elif traffic_density > 0.6 and delay > 30:
            time_to_accident = 30  # 30 min to collision
        elif delay > 40:
            time_to_accident = 45  # 45 min buildup
        
        return max(0, time_to_accident)
    
    def forward_simulate(self, current_obs: Dict, 
                        horizons_minutes: List[int] = None) -> Dict[int, BayesianPrediction]:
        """
        Forward-simulate accident risk at future time horizons.
        
        Predicts how risk will evolve (delays compound, traffic builds).
        
        Args:
            current_obs: Current observations
            horizons_minutes: Time windows to predict (default: [15, 30, 60])
            
        Returns:
            {
                15: BayesianPrediction(...),
                30: BayesianPrediction(...),
                60: BayesianPrediction(...)
            }
        """
        
        if horizons_minutes is None:
            horizons_minutes = [15, 30, 60]
        
        predictions = {}
        
        # Current risk
        current_pred = self.update_belief(current_obs)
        
        # For each future horizon, simulate delay accumulation
        for horizon in horizons_minutes:
            # Simulate: delays increase over time (~1 min per 5 min of travel)
            simulated_delay = current_obs.get('delay_minutes', 0) + (horizon // 5)
            
            # Simulate: traffic density increases
            simulated_density = min(1.0, current_obs.get('traffic_density', 0) + (horizon * 0.01))
            
            # Create simulated observations
            sim_obs = current_obs.copy()
            sim_obs['delay_minutes'] = int(simulated_delay)
            sim_obs['traffic_density'] = simulated_density
            
            # Predict at this horizon
            predictions[horizon] = self.update_belief(sim_obs)
        
        return predictions
    
    def explain_prediction(self, prediction: BayesianPrediction, 
                          observations: Dict) -> Dict:
        """
        Create human-readable explanation for a prediction.
        """
        
        causal_state = self._observations_to_causal_state(observations)
        explanation = self.causal_dag.explain_accident_risk(causal_state)
        
        risk_level = self._risk_level_text(prediction.p_accident)
        
        return {
            'risk_level': risk_level,
            'p_accident': round(prediction.p_accident, 3),
            'confidence': round(prediction.confidence, 2),
            'time_to_accident_minutes': prediction.time_to_accident_minutes,
            'causal_chains': explanation.get('causal_chains', []),
            'active_factors': explanation.get('active_factors', []),
        }
    
    def _risk_level_text(self, p_accident: float) -> str:
        """Text interpretation of risk"""
        if p_accident < 0.2:
            return "LOW"
        elif p_accident < 0.5:
            return "MEDIUM"
        elif p_accident < 0.75:
            return "HIGH"
        else:
            return "CRITICAL"


def main():
    """Development/testing"""
    logging.basicConfig(level=logging.INFO)
    
    # Load causal DAG
    from backend.data.crs_parser import CRSParser
    from backend.ml.causal_dag import CausalDAGBuilder
    
    parser = CRSParser()
    corpus = parser.get_corpus()
    
    dag_builder = CausalDAGBuilder(corpus)
    dag_builder.build_manual_dag()
    dag_builder.validate_dag()
    
    # Initialize Bayesian network
    bayesian = BayesianRiskNetwork(dag_builder)
    
    print("\n=== Bayesian Network Inference ===")
    
    # Test cases
    test_cases = [
        {
            "name": "Normal train operations",
            "obs": {
                'maintenance_active': False,
                'delay_minutes': 5,
                'signal_cycle_time': 4.0,
                'traffic_density': 0.3,
                'time_of_day': 'DAY',
                'centrality_rank': 40,
            }
        },
        {
            "name": "High delay, night shift",
            "obs": {
                'maintenance_active': False,
                'delay_minutes': 45,
                'signal_cycle_time': 4.5,
                'traffic_density': 0.8,
                'time_of_day': 'NIGHT',
                'centrality_rank': 80,
            }
        },
        {
            "name": "Balasore-like conditions",
            "obs": {
                'maintenance_active': True,
                'delay_minutes': 45,
                'signal_cycle_time': 7.5,
                'traffic_density': 0.9,
                'time_of_day': 'NIGHT',
                'centrality_rank': 99,
            }
        },
    ]
    
    for test in test_cases:
        print(f"\n--- {test['name']} ---")
        
        # Get prediction
        pred = bayesian.update_belief(test['obs'])
        
        # Get explanation
        explanation = bayesian.explain_prediction(pred, test['obs'])
        
        print(f"P(accident) = {pred.p_accident:.3f}")
        print(f"Risk level: {explanation['risk_level']}")
        print(f"Confidence: {explanation['confidence']}")
        print(f"Time to accident: {pred.time_to_accident_minutes} min")
        print(f"Active factors: {explanation['active_factors']}")
        
        # Forward simulation
        simulations = bayesian.forward_simulate(test['obs'])
        print(f"\nForward simulation:")
        for horizon, sim_pred in simulations.items():
            print(f"  +{horizon}min: P(accident)={sim_pred.p_accident:.3f}")


if __name__ == "__main__":
    main()
