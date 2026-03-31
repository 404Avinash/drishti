"""
End-to-End Test: From Inference to Production Alert
Shows complete flow: Features → 4 ML Methods → Ensemble Voting → Alert Generation → Audit Log
"""

import asyncio
import sys
sys.path.insert(0, '.')

from backend.inference.engine import UnifiedInferenceEngine


async def test_end_to_end():
    """Test complete pipeline with mixed normal and high-risk trains"""
    
    print("\n" + "="*70)
    print("DRISHTI END-TO-END TEST: Inference -> Alerts -> Audit Trail")
    print("="*70 + "\n")
    
    engine = UnifiedInferenceEngine()
    
    # Simulate NTES data: Mix of normal and high-risk trains
    trains = [
        {
            "train_id": "12841_NORMAL",
            "station": "Bahanaga Bazar",
            "delay": 15,
            "speed": 75,
            "route_id": "route_1",
            "time_of_day": 14,
            "maintenance_active": False,
            "lat": 20.5,
            "lon": 85.8
        },
        {
            "train_id": "12003_AT_RISK",
            "station": "Gaisal",
            "delay": 50,      # High delay
            "speed": 45,      # Slow
            "route_id": "route_1",
            "time_of_day": 2,  # Night (dangerous hour)
            "maintenance_active": True,  # Maintenance active
            "lat": 20.6,
            "lon": 85.9
        },
        {
            "train_id": "13015_CRITICAL",
            "station": "Agartala",
            "delay": 95,      # Very high delay
            "speed": 25,      # Very slow
            "route_id": "route_2",
            "time_of_day": 3,  # Night
            "maintenance_active": True,
            "lat": 23.8,
            "lon": 91.3
        }
    ]
    
    # Run batch inference
    print("Running batch inference on 3 trains...")
    print("-" * 70)
    
    result = await engine.infer_batch(trains)
    
    print(f"\nBatch Results:")
    print(f"  Total trains: {result['total_trains']}")
    print(f"  Alerts fired: {result['alerts_fired']}")
    print(f"  Critical alerts: {result['critical_alerts']}")
    print(f"  Latency: {result['latency_ms']:.1f} ms")
    print()
    
    # Show alerts in detail
    if result['alerts'] and len(result['alerts']) > 0:
        print("-" * 70)
        print("ALERTS GENERATED:")
        print("-" * 70)
        for i, alert in enumerate(result['alerts'], 1):
            print(f"\nAlert #{i}:")
            print(f"  Alert ID: {alert.get('alert_id', 'N/A')[:16]}...")
            print(f"  Train: {alert.get('train_id')}")
            print(f"  Station: {alert.get('station')}")
            print(f"  Severity: {alert.get('severity')}")
            print(f"  Risk Score: {alert.get('risk_score'):.1f}")
            print(f"  Methods Agreeing: {alert.get('methods_agreeing')}/4")
            print(f"  Bayesian Risk: {alert.get('bayesian_risk'):.3f}")
            print(f"  Anomaly Score: {alert.get('anomaly_score'):.1f}")
            print(f"  Causal Risk: {alert.get('causal_risk'):.3f}")
            print(f"  Explanation: {alert.get('explanation', {}).get('primary', 'N/A')}")
            print(f"  Actions: {', '.join(alert.get('actions', [])[:2])}...")
    else:
        print("No alerts fired (all trains operating normally)")
    
    # Show audit log statistics
    print("\n" + "-" * 70)
    print("AUDIT LOG STATISTICS:")
    print("-" * 70)
    stats = engine.audit_log.get_statistics()
    print(f"  Total alerts recorded: {stats.get('total_alerts', 0)}")
    print(f"  Critical: {stats.get('critical', 0)}")
    print(f"  High: {stats.get('high', 0)}")
    print(f"  Medium: {stats.get('medium', 0)}")
    print(f"  Acknowledged: {stats.get('acknowledged', 0)}/{stats.get('total_alerts', 0)}")
    
    print("\n" + "="*70)
    print("[OK] END-TO-END TEST COMPLETE")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(test_end_to_end())
