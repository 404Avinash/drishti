"""
Direct Alert Generation Demonstration
Shows that alerts WORK when ML methods flag danger
(Simulates high-risk ML scores)
"""

import asyncio
from datetime import datetime
import sys
sys.path.insert(0, '.')

from backend.alerts.engine import AlertGenerator, AuditLog


async def demo_alert_generation():
    """Demonstrate alert generation with various risk scenarios"""
    
    print("\n" + "="*70)
    print("DRISHTI ALERT SYSTEM DEMONSTRATION")
    print("="*70 + "\n")
    
    generator = AlertGenerator()
    audit_log = AuditLog(log_file="demo_alerts.jsonl")
    
    # Scenario 1: Normal operations - no alert
    print("Scenario 1: NORMAL TRAIN (maintenance=False, delay=20m)")
    print("-" * 70)
    alert1 = generator.generate_alert(
        train_id="NORMAL_001",
        station="Bahanaga Bazar",
        bayesian_risk=0.05,
        anomaly_score=0.1,
        causal_risk=0.01,
        trajectory_anomaly=False,
        methods_voting={
            "bayesian": False,
            "isolation_forest": False,
            "dbscan": False,
            "causal_dag": False
        },
        actions=[]
    )
    print(f"  Severity: {alert1.severity}")
    print(f"  Alert fires: {alert1.severity != 'LOW'}")
    print(f"  Methods: {alert1.methods_agreeing}/4")
    print()
    
    # Scenario 2: Two methods flag danger - ALERT FIRES
    print("Scenario 2: AT-RISK TRAIN (maintenance=True, delay=45m, night)")
    print("-" * 70)
    alert2 = generator.generate_alert(
        train_id="AT_RISK_002",
        station="Gaisal",
        bayesian_risk=0.60,        # Moderate Bayesian risk
        anomaly_score=0.75,        # High anomaly
        causal_risk=0.40,
        trajectory_anomaly=False,
        methods_voting={
            "bayesian": True,       # OVER THRESHOLD
            "isolation_forest": True,  # OVER THRESHOLD
            "dbscan": False,
            "causal_dag": False
        },
        actions=[
            "WARNING_TO_LOCO_PILOT",
            "NOTIFY_SECTION_CONTROLLER"
        ]
    )
    print(f"  Severity: {alert2.severity}")
    print(f"  Risk Score: {alert2.risk_score:.1f}/100")
    print(f"  Alert fires: {alert2.severity != 'LOW'}")
    print(f"  Methods: {alert2.methods_agreeing}/4")
    print(f"  Signature: {alert2.signature.algorithm}")
    audit_log.record_alert(alert2)
    print("  Status: ALERT RECORDED IN AUDIT LOG")
    print()
    
    # Scenario 3: Three methods flag + high risk - CRITICAL
    print("Scenario 3: CRITICAL TRAIN (all risk factors)")
    print("-" * 70)
    alert3 = generator.generate_alert(
        train_id="CRITICAL_003",
        station="Agartala",
        bayesian_risk=0.92,        # CRITICAL Bayesian
        anomaly_score=0.95,        # CRITICAL anomaly
        causal_risk=0.80,          # CRITICAL causal
        trajectory_anomaly=True,   # CRITICAL trajectory
        methods_voting={
            "bayesian": True,       # OVER THRESHOLD
            "isolation_forest": True,  # OVER THRESHOLD
            "dbscan": True,         # CRITICAL SIGNAL
            "causal_dag": True      # OVER THRESHOLD
        },
        actions=[
            "EMERGENCY_ALERT_TO_LOCO_PILOT",
            "ALERT_ADJACENT_TRAINS",
            "NOTIFY_SIGNALLING_CENTER",
            "LOG_IMMUTABLE_AUDIT"
        ]
    )
    print(f"  Severity: {alert3.severity}")
    print(f"  Risk Score: {alert3.risk_score:.1f}/100")
    print(f"  Certainty: {alert3.certainty:.2%}")
    print(f"  Alert fires: {alert3.severity != 'LOW'}")
    print(f"  Methods: {alert3.methods_agreeing}/4")
    print(f"  Actions: {len(alert3.actions)}")
    audit_log.record_alert(alert3)
    print("  Status: CRITICAL ALERT RECORDED")
    print()
    
    # Scenario 4: Driver acknowledges alert
    print("Scenario 4: DRIVER ACKNOWLEDGMENT")
    print("-" * 70)
    audit_log.record_acknowledgment(
        alert_id=alert3.alert_id,
        acknowledged_by="Loco_Pilot_ML-12"
    )
    print(f"  Alert {alert3.alert_id[:12]}... acknowledged")
    print(f"  By: Loco_Pilot_ML-12")
    print()
    
    # Show audit log statistics
    print("=" * 70)
    print("AUDIT LOG SUMMARY")
    print("=" * 70)
    stats = audit_log.get_statistics()
    print(f"  Total alerts: {stats.get('total_alerts', 0)}")
    print(f"  Severity breakdown:")
    print(f"    - CRITICAL: {stats.get('critical', 0)}")
    print(f"    - HIGH: {stats.get('high', 0)}")
    print(f"    - MEDIUM: {stats.get('medium', 0)}")
    print(f"    - LOW: {stats['total_alerts'] - stats.get('critical', 0) - stats.get('high', 0) - stats.get('medium', 0)}")
    print(f"  Acknowledged: {stats.get('acknowledged', 0)}/{stats['total_alerts']}")
    print()
    
    # Query alerts
    print("Query: Critical alerts only")
    critical = audit_log.query_alerts(severity="CRITICAL")
    for alert in critical:
        print(f"  - {alert.train_id}: {alert.explanation.primary}")
    print()
    
    print("=" * 70)
    print("[OK] ALERT DEMONSTRATION COMPLETE")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(demo_alert_generation())
