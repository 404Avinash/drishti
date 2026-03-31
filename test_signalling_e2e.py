"""
Phase 4.3 End-to-End Tests
Signalling System Integration + Complete Pipeline Validation
"""

import uuid
from datetime import datetime
from backend.alerts.engine import DrishtiAlert, AlertExplanation, CryptographicSignature
from backend.integration.pipeline import DrishtiPipeline, PipelineValidator
from backend.signalling.controller import (
    SignallingController, SignallingStation, SignalControl, 
    TrackSection, SignalStatus, TrackOccupancy
)


def setup_test_infrastructure() -> tuple:
    """Setup test signalling infrastructure"""
    
    pipeline = DrishtiPipeline()
    controller = pipeline.signalling_controller
    
    # Register stations
    stations = [
        ("BAL", "Balasore", 150.5),
        ("CUT", "Cuttack", 165.0),
        ("BBD", "Bhubaneswar", 175.0)
    ]
    
    for station_id, name, km in stations:
        controller.register_station(SignallingStation(
            station_id=station_id,
            station_name=name,
            location_km=km,
            line_code=f"SEC_{int(km)}",
            signals_controlled=[f"{station_id}_HOME_1", f"{station_id}_HOME_2"],
            interlocked_stations=[s[0] for s in stations if s[0] != station_id],
            track_sections=[f"SEC_{int(km)}_A", f"SEC_{int(km)}_B"]
        ))
    
    # Register signals
    signal_ids = []
    for station_id, _, km in stations:
        for i in range(1, 3):
            sig_id = f"{station_id}_HOME_{i}"
            controller.register_signal(SignalControl(
                signal_id=sig_id,
                station_id=station_id,
                signal_type="Home",
                current_status=SignalStatus.GREEN,
                next_status=SignalStatus.GREEN,
                km_marker=km + (i-1)*0.25,
                protects_train=f"TRAIN_{i:05d}"
            ))
            signal_ids.append(sig_id)
    
    # Register track sections
    for i in range(len(stations)-1):
        section_id = f"SEC_{int(stations[i][2])}_A"
        controller.register_track_section(TrackSection(
            section_id=section_id,
            station_from=stations[i][0],
            station_to=stations[i+1][0],
            km_marker_start=stations[i][2],
            km_marker_end=stations[i+1][2],
            occupancy_status=TrackOccupancy.CLEAR
        ))
    
    return pipeline, signal_ids


def create_mock_alert(severity: str, train_id: str = "TRAIN_12345") -> DrishtiAlert:
    """Create mock alert for testing"""
    return DrishtiAlert(
        alert_id=str(uuid.uuid4()),
        timestamp=datetime.now().isoformat(),
        train_id=train_id,
        station="Balasore",
        risk_score=85.0 if severity == "CRITICAL" else 65.0,
        severity=severity,
        certainty=0.85 if severity == "CRITICAL" else 0.65,
        methods_agreeing=3,
        bayesian_risk=85.0,
        anomaly_score=75.0,
        causal_risk=80.0,
        trajectory_anomaly=True,
        explanation=AlertExplanation(
            primary=f"Multiple ML methods detect {severity} risk",
            secondary_factors=["Factor 1", "Factor 2", "Factor 3"],
            methods_voting={'bayesian': True, 'if': True, 'causal': True, 'dbscan': False},
            confidence_percent=85 if severity == "CRITICAL" else 65
        ),
        actions=["REDUCE_SPEED_TO_20_KMPH", "ALERT_ADJACENT_TRAINS", "NOTIFY_SIGNALLING_CENTER"],
        signature=CryptographicSignature(
            algorithm="SHA256_MOCK",
            public_key_hex="mock_key",
            signature_hex="mock_sig",
            message_hash="mock_hash"
        )
    )


def create_train_data(station: str = "Balasore", km: float = 150.5) -> dict:
    """Create mock train data"""
    return {
        'current_station': 'BAL',
        'current_station_name': station,
        'latitude': 21.4774,
        'longitude': 86.9479,
        'km_marker': km,
        'track_section': f'SEC_{int(km)}_A',
        'speed': 75.0,
        'speed_limit': 100.0,
        'acceleration': 0.2,
        'brake_status': 'normal',
        'delay_minutes': 5,
        'next_station': 'Cuttack',
        'eta_minutes': 15
    }


def test_signalling_controller_initialization():
    """TEST 1: Signalling controller setup"""
    print("\n" + "="*80)
    print("TEST 1: Signalling Controller Initialization")
    print("="*80)
    
    controller = SignallingController()
    
    # Register test infrastructure
    controller.register_station(SignallingStation(
        station_id="BAL",
        station_name="Balasore",
        location_km=150.5,
        line_code="SEC_150",
        signals_controlled=["BAL_HOME_1", "BAL_HOME_2"],
        interlocked_stations=["CUT"],
        track_sections=["SEC_150_A"]
    ))
    
    controller.register_signal(SignalControl(
        signal_id="BAL_HOME_1",
        station_id="BAL",
        signal_type="Home",
        current_status=SignalStatus.GREEN,
        next_status=SignalStatus.GREEN,
        km_marker=150.5,
        protects_train="TRAIN_12345"
    ))
    
    controller.register_track_section(TrackSection(
        section_id="SEC_150_A",
        station_from="BAL",
        station_to="CUT",
        km_marker_start=150.5,
        km_marker_end=165.0,
        occupancy_status=TrackOccupancy.CLEAR
    ))
    
    # Verify
    assert len(controller.stations) == 1, "Station registration failed"
    assert len(controller.signals) == 1, "Signal registration failed"
    assert len(controller.track_sections) == 1, "Track section registration failed"
    
    print("[OK] Station registered: BAL (Balasore)")
    print("[OK] Signal registered: BAL_HOME_1")
    print("[OK] Track section registered: SEC_150_A")
    
    status = controller.get_system_status()
    print(f"\n[STATUS] Stations: {status['stations_registered']}")
    print(f"[STATUS] Signals: {status['signals_registered']}")
    print(f"[STATUS] Track sections: {status['track_sections_registered']}")
    
    return True


def test_critical_alert_mitigation():
    """TEST 2: CRITICAL alert signalling mitigation"""
    print("\n" + "="*80)
    print("TEST 2: CRITICAL Alert Mitigation")
    print("="*80)
    
    pipeline, signal_ids = setup_test_infrastructure()
    controller = pipeline.signalling_controller
    
    alert = create_mock_alert("CRITICAL")
    train_data = create_train_data()
    
    # Execute alert
    result = pipeline.process_alert_complete_flow(alert, train_data)
    
    # Validate CRITICAL mitigation
    assert result['distribution_result']['hud_delivery']['success'], "HUD delivery failed"
    assert result['signalling_result'].status == 'completed', "Signalling not executed"
    
    # Check speed restriction
    speed = controller.get_speed_restriction(alert.train_id)
    assert speed == 0, f"Expected stop (0 kmph), got {speed}"
    print("[OK] Train stopped (0 kmph)")
    
    # Check signal status
    signal_status = controller.get_signal_status(signal_ids[0])
    assert signal_status is not None, "Signal status not found"
    print(f"[OK] Signal {signal_ids[0]} status checked")
    
    # Verify validations pass
    assert result['sanity_checks']['all_passed'], "Sanity checks failed"
    print("[OK] All sanity checks passed")
    
    return True


def test_high_alert_mitigation():
    """TEST 3: HIGH alert controlled speed reduction"""
    print("\n" + "="*80)
    print("TEST 3: HIGH Alert Mitigation")
    print("="*80)
    
    pipeline, _ = setup_test_infrastructure()
    controller = pipeline.signalling_controller
    
    alert = create_mock_alert("HIGH")
    train_data = create_train_data()
    
    # Execute alert
    result = pipeline.process_alert_complete_flow(alert, train_data)
    
    # Validate HIGH mitigation
    assert result['signalling_result'].status == 'completed', "Signalling not executed"
    
    # Check speed restriction
    speed = controller.get_speed_restriction(alert.train_id)
    assert speed == 30, f"Expected 30 kmph, got {speed}"
    print("[OK] Speed reduced to 30 kmph")
    
    # Verify notifications sent
    notifications = result['distribution_result']['distribution_record']['notifications_sent']
    assert notifications >= 2, f"Expected 2+ notifications, got {notifications}"
    print(f"[OK] Notifications sent: {notifications}")
    
    return True


def test_track_occupancy_updates():
    """TEST 4: Track occupancy tracking"""
    print("\n" + "="*80)
    print("TEST 4: Track Occupancy Updates")
    print("="*80)
    
    controller = SignallingController()
    
    # Register track section
    section_id = "SEC_150_A"
    controller.register_track_section(TrackSection(
        section_id=section_id,
        station_from="BAL",
        station_to="CUT",
        km_marker_start=150.5,
        km_marker_end=165.0,
        occupancy_status=TrackOccupancy.CLEAR
    ))
    
    # Update occupancy
    train_id = "TRAIN_12345"
    controller.update_track_occupancy(section_id, train_id, TrackOccupancy.OCCUPIED)
    
    # Verify
    track_status = controller.get_track_status(section_id)
    assert track_status['occupancy'] == 'OCCUPIED', "Occupancy not updated"
    assert train_id in track_status['occupied_trains'], "Train not in occupancy list"
    print(f"[OK] Track {section_id} occupied by {train_id}")
    
    # Clear occupancy
    controller.update_track_occupancy(section_id, train_id, TrackOccupancy.CLEAR)
    track_status = controller.get_track_status(section_id)
    assert track_status['occupancy'] == 'CLEAR', "Occupancy not cleared"
    assert train_id not in track_status['occupied_trains'], "Train still in list"
    print(f"[OK] Track {section_id} cleared")
    
    return True


def test_multiple_trains_independent():
    """TEST 5: Multiple trains with independent mitigations"""
    print("\n" + "="*80)
    print("TEST 5: Multiple Trains Independent Control")
    print("="*80)
    
    pipeline, _ = setup_test_infrastructure()
    controller = pipeline.signalling_controller
    
    # Create alerts for multiple trains
    trains = [
        ("TRAIN_001", "CRITICAL", 150.5),
        ("TRAIN_002", "HIGH", 160.0),
        ("TRAIN_003", "MEDIUM", 170.0)
    ]
    
    for train_id, severity, km in trains:
        alert = create_mock_alert(severity, train_id)
        train_data = create_train_data(km=km)
        result = pipeline.process_alert_complete_flow(alert, train_data)
        assert result['sanity_checks']['all_passed'], f"Failed for {train_id}"
    
    # Verify independent speed restrictions
    speeds = {
        "TRAIN_001": controller.get_speed_restriction("TRAIN_001"),
        "TRAIN_002": controller.get_speed_restriction("TRAIN_002"),
        "TRAIN_003": controller.get_speed_restriction("TRAIN_003")
    }
    
    assert speeds["TRAIN_001"] == 0, "TRAIN_001 not stopped"
    assert speeds["TRAIN_002"] == 30, "TRAIN_002 not at 30 kmph"
    assert speeds["TRAIN_003"] == 50, "TRAIN_003 not at 50 kmph"
    
    print("[OK] TRAIN_001 (CRITICAL): 0 kmph")
    print("[OK] TRAIN_002 (HIGH): 30 kmph")
    print("[OK] TRAIN_003 (MEDIUM): 50 kmph")
    
    # Clear one train
    controller.clear_restrictions("TRAIN_001")
    speed = controller.get_speed_restriction("TRAIN_001")
    assert speed == 100, "TRAIN_001 speed not cleared"
    print("[OK] TRAIN_001 cleared - others unaffected")
    
    return True


def test_pipeline_validation():
    """TEST 6: Pipeline validator checks"""
    print("\n" + "="*80)
    print("TEST 6: Pipeline Validation")
    print("="*80)
    
    pipeline, _ = setup_test_infrastructure()
    
    severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    
    for severity in severities:
        alert = create_mock_alert(severity)
        train_data = create_train_data()
        result = pipeline.process_alert_complete_flow(alert, train_data)
        
        # Validate severity routing
        is_valid = PipelineValidator.validate_severity_routing(severity, result)
        assert is_valid, f"Severity routing failed for {severity}"
        print(f"[OK] {severity}: Severity routing valid")
        
        # Validate audit trail
        audit_valid = PipelineValidator.validate_audit_trail(result)
        assert audit_valid, f"Audit trail invalid for {severity}"
        print(f"[OK] {severity}: Audit trail valid")
    
    return True


def test_complete_pipeline_metrics():
    """TEST 7: Pipeline metrics and system status"""
    print("\n" + "="*80)
    print("TEST 7: Pipeline Metrics")
    print("="*80)
    
    pipeline, _ = setup_test_infrastructure()
    
    # Process multiple alerts
    for i in range(5):
        severity = "CRITICAL" if i % 2 == 0 else "HIGH"
        alert = create_mock_alert(severity, f"TRAIN_{i:05d}")
        train_data = create_train_data(km=150.5 + i*15)
        pipeline.process_alert_complete_flow(alert, train_data)
    
    # Get metrics
    metrics = pipeline.get_pipeline_metrics()
    
    assert metrics['total_alerts_processed'] == 5, "Incorrect alert count"
    print(f"[OK] Total alerts processed: {metrics['total_alerts_processed']}")
    
    assert metrics['alerts_by_severity']['CRITICAL'] == 3, "CRITICAL count incorrect"
    assert metrics['alerts_by_severity']['HIGH'] == 2, "HIGH count incorrect"
    print(f"[OK] Severity distribution: CRITICAL={metrics['alerts_by_severity']['CRITICAL']}, HIGH={metrics['alerts_by_severity']['HIGH']}")
    
    assert metrics['speed_restrictions_active'] >= 5, "Speed restrictions not active"
    print(f"[OK] Active speed restrictions: {metrics['speed_restrictions_active']}")
    
    print(f"[OK] System reliability: {metrics['system_reliability']}")
    
    return True


def test_alert_clearance():
    """TEST 8: Alert clearance and system recovery"""
    print("\n" + "="*80)
    print("TEST 8: Alert Clearance and Recovery")
    print("="*80)
    
    pipeline, _ = setup_test_infrastructure()
    
    alert = create_mock_alert("CRITICAL", "TRAIN_12345")
    train_data = create_train_data()
    
    # Execute alert
    result = pipeline.process_alert_complete_flow(alert, train_data)
    assert result['sanity_checks']['all_passed'], "Alert execution failed"
    print("[OK] CRITICAL alert executed")
    
    # Verify restriction in place
    speed_before = pipeline.signalling_controller.get_speed_restriction("TRAIN_12345")
    assert speed_before == 0, "Speed restriction not applied"
    print(f"[OK] Speed restriction active: {speed_before} kmph")
    
    # Clear alert
    success = pipeline.clear_train_alert("TRAIN_12345")
    assert success, "Alert clearance failed"
    print("[OK] Alert cleared by operator")
    
    # Verify restriction removed
    speed_after = pipeline.signalling_controller.get_speed_restriction("TRAIN_12345")
    assert speed_after == 100, f"Speed not restored, got {speed_after}"
    print(f"[OK] Speed restriction removed: {speed_after} kmph")
    
    return True


def run_all_tests():
    """Run complete test suite"""
    print("\n\n")
    print("+"*80)
    print("|" + " "*78 + "|")
    header1 = "PHASE 4.3: SIGNALLING SYSTEM INTEGRATION - COMPLETE TEST SUITE"
    header2 = "End-to-End: ML Alerts -> HUD -> Notifications -> Signalling"
    print("|" + header1.center(78) + "|")
    print("|" + header2.center(78) + "|")
    print("|" + " "*78 + "|")
    print("+"*80)
    
    tests = [
        ("Signalling Initialization", test_signalling_controller_initialization),
        ("CRITICAL Alert Mitigation", test_critical_alert_mitigation),
        ("HIGH Alert Mitigation", test_high_alert_mitigation),
        ("Track Occupancy Updates", test_track_occupancy_updates),
        ("Multiple Trains Independent", test_multiple_trains_independent),
        ("Pipeline Validation", test_pipeline_validation),
        ("Pipeline Metrics", test_complete_pipeline_metrics),
        ("Alert Clearance and Recovery", test_alert_clearance)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            failed += 1
            print(f"\n[FAIL] {test_name}")
            print(f"   Error: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n\n" + "="*80)
    print("TEST SUMMARY - PHASE 4.3 SIGNALLING INTEGRATION")
    print("="*80)
    print(f"Passed: {passed}/{len(tests)}")
    print(f"Failed: {failed}/{len(tests)}")
    print(f"Success Rate: {100*passed//len(tests)}%")
    print("="*80)
    
    if failed == 0:
        print("\n[OK] ALL TESTS PASSED - Signalling Integration Ready for Deployment")
        print("\nSystem Pipeline Complete:")
        print("  1. ML Inference (Bayesian, IF, DBSCAN, Causal DAG)")
        print("  2. Alert Generation (Cryptographic signatures)")
        print("  3. HUD Display (Loco cabin notifications)")
        print("  4. Multi-channel Notifications (SMS, Email, Push, WhatsApp)")
        print("  5. Signalling Mitigation (Auto signal control)")
    else:
        print(f"\n[FAIL] {failed} TEST(S) FAILED")
    
    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    exit(0 if success else 1)
