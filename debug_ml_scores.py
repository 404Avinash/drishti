"""Debug: Check what ML methods are scoring"""

import asyncio
import sys
sys.path.insert(0, '.')

from backend.inference.engine import UnifiedInferenceEngine


async def debug_ml_scores():
    engine = UnifiedInferenceEngine()
    
    # High-risk test train
    train = {
        "train_id": "TRAIN_DEBUG",
        "station": "Gaisal",
        "delay": 80,
        "speed": 30,
        "route_id": "route_1",
        "time_of_day": 3,  # Night
        "maintenance_active": True,
        "lat": 20.6,
        "lon": 85.9
    }
    
    # Extract features
    features = {
        "delay": train["delay"],
        "speed": train["speed"],
        "density": 0.7,  # High traffic
        "time_of_day": train["time_of_day"],
        "route_id": train["route_id"],
        "maintenance_active": train["maintenance_active"],
        "lat": train["lat"],
        "lon": train["lon"]
    }
    
    # Get individual scores
    bayesian_risk = await engine._get_bayesian_risk(features)
    anomaly_score = await engine._get_anomaly_score("TRAIN_DEBUG", features)
    causal_risk = await engine._get_causal_risk(features)
    dbscan_anomaly = await engine._get_dbscan_anomaly("TRAIN_DEBUG", [train])
    
    print("\nML SCORES FOR HIGH-RISK TRAIN:")
    print(f"  Bayesian Risk: {bayesian_risk:.3f} (threshold: 0.7)")
    print(f"  Anomaly Score: {anomaly_score:.1f} (threshold: 80)")
    print(f"  Causal Risk: {causal_risk:.3f} (threshold: 0.75)")
    print(f"  DBSCAN Anomaly: {dbscan_anomaly}")
    print()
    print(f"  Methods above threshold:")
    if bayesian_risk > 0.7:
        print(f"    - Bayesian DANGER")
    if anomaly_score > 80:
        print(f"    - IF DANGER")
    if causal_risk > 0.75:
        print(f"    - Causal DANGER")
    if dbscan_anomaly:
        print(f"    - DBSCAN DANGER")


asyncio.run(debug_ml_scores())
