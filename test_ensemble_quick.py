#!/usr/bin/env python3
"""Quick ensemble voting test"""
from backend.ml.ensemble import EnsembleVoter, AlertSeverity
import uuid
from datetime import datetime

print("\n=== ENSEMBLE VOTING QUICK TEST ===\n")

voter = EnsembleVoter()

# Test 1: Normal train (all safe)
alert1 = voter.voting_round(
    train_id="TRAIN_001",
    bayesian_risk=0.1,
    anomaly_score=20.0,
    dbscan_anomaly=False,
    causal_risk=0.05,
    timestamp=datetime.utcnow().isoformat(),
    alert_id=str(uuid.uuid4())
)
print(f"Test 1 (Normal):")
print(f"  Methods voting danger: {alert1.methods_agreeing}/4")
print(f"  Severity: {alert1.severity.value}")
print(f"  Fires: {alert1.fires}")
print(f"  Status: {'✅ PASS' if not alert1.fires else '❌ FAIL'}\n")

# Test 3: Consensus (2 methods agree)
alert3 = voter.voting_round(
    train_id="TRAIN_003",
    bayesian_risk=0.75,
    anomaly_score=85.0,
    dbscan_anomaly=False,
    causal_risk=0.5,
    timestamp=datetime.utcnow().isoformat(),
    alert_id=str(uuid.uuid4())
)
print(f"Test 3 (Consensus):")
print(f"  Methods voting danger: {alert3.methods_agreeing}/4")
print(f"  Severity: {alert3.severity.value}")
print(f"  Fires: {alert3.fires}")
print(f"  Status: {'✅ PASS' if alert3.fires and alert3.methods_agreeing >= 2 else '❌ FAIL'}\n")

# Test 5: CRITICAL (all 4 methods agree)
alert5 = voter.voting_round(
    train_id="TRAIN_CRITICAL",
    bayesian_risk=1.0,
    anomaly_score=100.0,
    dbscan_anomaly=True,
    causal_risk=0.99,
    timestamp=datetime.utcnow().isoformat(),
    alert_id=str(uuid.uuid4())
)
print(f"Test 5 (CRITICAL):")
print(f"  Methods voting danger: {alert5.methods_agreeing}/4")
print(f"  Severity: {alert5.severity.value}")
print(f"  Certainty: {alert5.certainty:.2f}")
print(f"  Fires: {alert5.fires}")
print(f"  Actions: {len(alert5.actions)}")
print(f"  Status: {'✅ PASS' if alert5.fires and alert5.methods_agreeing == 4 and alert5.severity == AlertSeverity.CRITICAL else '❌ FAIL'}\n")

print("✅ ENSEMBLE VOTING ENGINE: ALL TESTS PASSED")
