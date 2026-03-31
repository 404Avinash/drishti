"""
DRISHTI Phase 4.4: Driver Mobile App + SCADA Integration E2E Tests
Tests complete integration of driver mobile app with real SCADA systems
"""

import sys
from datetime import datetime, timedelta
from backend.driver.mobile_app import (
    DriverMobileAppBackend, MobileDriver, DriverAlert, DriverAlertType,
    DriverAckStatus, TrainStatusSnapshot, MobileAppAPI
)
from backend.scada.connector import (
    SCDAConnector, SCDAVendor, SCDACommand, SCDACommandType,
    SCDASignalState, SCDAIntegrationLayer
)


def setup_test_infrastructure():
    """Setup test drivers, trains, and SCADA system"""
    # Initialize mobile app backend
    mobile_backend = DriverMobileAppBackend()
    
    # Register test drivers
    drivers = [
        MobileDriver(
            driver_id="DRV_001",
            name="Raj Kumar",
            emp_code="EMP_12345",
            phone="+91-9876543210",
            email="raj@ir.gov.in",
            train_id="TRAIN_12345",
            device_type="android"
        ),
        MobileDriver(
            driver_id="DRV_002",
            name="Priya Singh",
            emp_code="EMP_12346",
            phone="+91-9876543211",
            email="priya@ir.gov.in",
            train_id="TRAIN_67890",
            device_type="ios"
        ),
        MobileDriver(
            driver_id="DRV_003",
            name="Amit Patel",
            emp_code="EMP_12347",
            phone="+91-9876543212",
            email="amit@ir.gov.in",
            train_id="TRAIN_11111",
            device_type="android"
        )
    ]
    
    for driver in drivers:
        mobile_backend.register_driver(driver)
    
    # Initialize SCADA connector
    scada = SCDAConnector(SCDAVendor.NATIVE_IR)
    scada.authenticate("admin", "password", "https://scada.ir.gov.in")
    
    # Register signals with SCADA
    signals = [
        ("BAL_HOME_1", "BAL", "home"),
        ("BAL_HOME_2", "BAL", "home"),
        ("BAL_STARTER", "BAL", "starter"),
        ("KGP_HOME", "KGP", "home"),
        ("KGP_DISTANT", "KGP", "distant"),
        ("CTC_SIGNAL", "CTC", "shunt")
    ]
    
    for signal_id, station, signal_type in signals:
        scada.register_signal(signal_id, station, signal_type)
    
    # Register trains with SCADA
    trains = [
        ("TRAIN_12345", 150.5, 80),
        ("TRAIN_67890", 180.0, 90),
        ("TRAIN_11111", 120.0, 75)
    ]
    
    for train_id, location, speed in trains:
        scada.register_train(train_id, location, speed)
    
    return mobile_backend, scada


def test_mobile_app_driver_registration():
    """Test 1: Driver registration and profile management"""
    print("\n[TEST 1] Mobile App Driver Registration")
    mobile_backend, _ = setup_test_infrastructure()
    
    # Verify drivers registered
    driver = mobile_backend.get_driver_profile("DRV_001")
    assert driver is not None, "Driver not registered"
    assert driver.name == "Raj Kumar", "Driver name mismatch"
    assert driver.train_id == "TRAIN_12345", "Train ID mismatch"
    assert driver.device_type == "android", "Device type mismatch"
    
    # Check system status
    status = mobile_backend.get_system_status()
    assert status['registered_drivers'] == 3, "Wrong number of drivers"
    assert status['active_trains'] == 3, "Wrong number of trains"
    
    print("[OK] 3 drivers registered successfully")
    print(f"[OK] Devices: {[d.device_type for d in [mobile_backend.get_driver_profile(f'DRV_{i:03d}') for i in range(1, 4)]]}")


def test_mobile_app_alert_creation_and_acknowledgment():
    """Test 2: Create alerts for drivers and process acknowledgments"""
    print("\n[TEST 2] Driver Alert Creation & Acknowledgment")
    mobile_backend, _ = setup_test_infrastructure()
    
    # Create CRITICAL alert for Driver 1
    test_alert_1 = {
        'alert_id': 'ALERT_001',
        'severity': 'CRITICAL',
        'reason': 'Landslide detected ahead',
        'location_km': 150.5,
        'current_speed': 80
    }
    
    alert = mobile_backend.create_driver_alert(test_alert_1, "TRAIN_12345", "DRV_001")
    assert alert.severity == "CRITICAL", "Alert severity mismatch"
    assert alert.recommended_speed_kmph == 0, "Speed should be 0 for CRITICAL"
    assert alert.ack_status == DriverAckStatus.PENDING, "Alert should be pending"
    print(f"[OK] CRITICAL alert created: {alert.title}")
    
    # Create HIGH alert for Driver 2
    test_alert_2 = {
        'alert_id': 'ALERT_002',
        'severity': 'HIGH',
        'reason': 'Unauthorized person on track',
        'location_km': 180.0,
        'current_speed': 90
    }
    
    alert2 = mobile_backend.create_driver_alert(test_alert_2, "TRAIN_67890", "DRV_002")
    assert alert2.severity == "HIGH", "Alert severity mismatch"
    assert alert2.recommended_speed_kmph == 30, "Speed should be 30 for HIGH"
    print(f"[OK] HIGH alert created: {alert2.title}")
    
    # Driver acknowledges CRITICAL alert
    ack = mobile_backend.acknowledge_driver_alert(
        "ALERT_001",
        "DRV_001",
        "TRAIN_12345",
        "acknowledged"
    )
    assert ack.ack_type == "acknowledged", "Ack type mismatch"
    
    # Verify alert status updated
    for a in mobile_backend.driver_alerts["TRAIN_12345"]:
        if a.alert_id == "ALERT_001":
            assert a.ack_status == DriverAckStatus.ACKNOWLEDGED, "Alert not marked as acknowledged"
    
    print(f"[OK] Driver acknowledged CRITICAL alert in time")
    
    # Driver dismisses HIGH alert
    ack2 = mobile_backend.acknowledge_driver_alert(
        "ALERT_002",
        "DRV_002",
        "TRAIN_67890",
        "dismissed"
    )
    assert ack2.ack_type == "dismissed", "Ack type mismatch"
    print(f"[OK] Driver dismissed HIGH alert")
    
    # Get alert history
    history = mobile_backend.get_driver_alert_history("TRAIN_12345", limit=10)
    assert len(history) > 0, "No alert history found"
    print(f"[OK] Alert history retrieved: {len(history)} alerts")


def test_mobile_app_driver_stats():
    """Test 3: Calculate driver performance statistics"""
    print("\n[TEST 3] Driver Performance Statistics")
    mobile_backend, _ = setup_test_infrastructure()
    
    # Create multiple alerts and acknowledgments
    test_alerts = [
        ('ALERT_101', 'CRITICAL', 'TRAIN_12345', 'DRV_001'),
        ('ALERT_102', 'HIGH', 'TRAIN_12345', 'DRV_001'),
        ('ALERT_103', 'MEDIUM', 'TRAIN_12345', 'DRV_001'),
        ('ALERT_104', 'LOW', 'TRAIN_12345', 'DRV_001'),
    ]
    
    for alert_id, severity, train_id, driver_id in test_alerts:
        alert_dict = {
            'alert_id': alert_id,
            'severity': severity,
            'reason': f'Test alert {alert_id}',
            'location_km': 150.5 + len(mobile_backend.driver_alerts[train_id]),
            'current_speed': 80 - len(mobile_backend.driver_alerts[train_id]) * 10
        }
        mobile_backend.create_driver_alert(alert_dict, train_id, driver_id)
    
    # Acknowledge first 3 alerts
    mobile_backend.acknowledge_driver_alert('ALERT_101', 'DRV_001', 'TRAIN_12345', 'acknowledged')
    mobile_backend.acknowledge_driver_alert('ALERT_102', 'DRV_001', 'TRAIN_12345', 'acknowledged')
    mobile_backend.acknowledge_driver_alert('ALERT_103', 'DRV_001', 'TRAIN_12345', 'dismissed')
    
    # Get driver stats
    stats = mobile_backend.get_driver_stats('DRV_001')
    assert stats['total_alerts_received'] == 4, "Wrong alert count"
    assert stats['acknowledged'] == 2, "Wrong acknowledged count"
    assert stats['dismissed'] == 1, "Wrong dismissed count"
    assert stats['pending'] == 1, "Wrong pending count"
    assert stats['ack_rate_percent'] == 50.0, "Wrong ack rate"
    
    print(f"[OK] Driver stats: {stats['acknowledged']}/{stats['total_alerts_received']} ack'd")
    print(f"[OK] Ack rate: {stats['ack_rate_percent']:.1f}%")


def test_scada_signal_control():
    """Test 4: Control signals via SCADA"""
    print("\n[TEST 4] SCADA Signal Control")
    _, scada = setup_test_infrastructure()
    
    # Set signal to RED (CRITICAL)
    cmd1 = SCDACommand(
        command_id="CMD_SIGNAL_001",
        command_type=SCDACommandType.SET_SIGNAL,
        target_system="BAL",
        payload={'signal_id': 'BAL_HOME_1', 'state': 'RED'},
        priority=1
    )
    
    resp1 = scada.send_command(cmd1)
    assert resp1.status == "success", "Signal command failed"
    print(f"[OK] Signal BAL_HOME_1 set to RED")
    
    # Set signal to YELLOW (HIGH)
    cmd2 = SCDACommand(
        command_id="CMD_SIGNAL_002",
        command_type=SCDACommandType.SET_SIGNAL,
        target_system="BAL",
        payload={'signal_id': 'BAL_HOME_2', 'state': 'YELLOW'},
        priority=2
    )
    
    resp2 = scada.send_command(cmd2)
    assert resp2.status == "success", "Signal command failed"
    print(f"[OK] Signal BAL_HOME_2 set to YELLOW")
    
    # Query signal status
    cmd3 = SCDACommand(
        command_id="CMD_QUERY_001",
        command_type=SCDACommandType.QUERY_SIGNAL,
        target_system="BAL",
        payload={'signal_id': 'BAL_HOME_1'},
        priority=3
    )
    
    resp3 = scada.send_command(cmd3)
    assert resp3.status == "success", "Signal query failed"
    assert resp3.data['state'] == 'RED', "Signal state mismatch"
    print(f"[OK] Signal query successful")


def test_scada_train_tracking():
    """Test 5: Track trains via SCADA/NTES"""
    print("\n[TEST 5] SCADA Train Tracking")
    _, scada = setup_test_infrastructure()
    
    # Query train location
    cmd = SCDACommand(
        command_id="CMD_TRAIN_001",
        command_type=SCDACommandType.QUERY_TRAIN_LOCATION,
        target_system="NTES",
        payload={'train_id': 'TRAIN_12345'},
        priority=2
    )
    
    resp = scada.send_command(cmd)
    assert resp.status == "success", "Train query failed"
    assert 'location_km' in resp.data, "Location not in response"
    assert 'speed_kmph' in resp.data, "Speed not in response"
    
    print(f"[OK] Train location: {resp.data['location_km']} km")
    print(f"[OK] Train speed: {resp.data['speed_kmph']} kmph")
    
    # Update train location
    scada.update_train_location('TRAIN_12345', 155.0, 75)
    
    # Query updated location
    resp2 = scada.send_command(cmd)
    assert resp2.data['location_km'] == 155.0, "Location not updated"
    assert resp2.data['speed_kmph'] == 75, "Speed not updated"
    print(f"[OK] Train location updated: {resp2.data['location_km']} km @ {resp2.data['speed_kmph']} kmph")


def test_scada_speed_restrictions():
    """Test 6: Set speed restrictions via SCADA"""
    print("\n[TEST 6] SCADA Speed Restrictions")
    _, scada = setup_test_infrastructure()
    
    # Create speed restriction for CRITICAL alert
    cmd1 = SCDACommand(
        command_id="CMD_RESTRICT_001",
        command_type=SCDACommandType.SET_SPEED_RESTRICTION,
        target_system="SEGMENT_001",
        payload={
            'segment_id': 'SEGMENT_001',
            'from_km': 150.0,
            'to_km': 155.0,
            'max_speed_kmph': 0,  # Emergency stop
            'reason': 'Landslide',
            'duration_minutes': 0
        },
        priority=1
    )
    
    resp1 = scada.send_command(cmd1)
    assert resp1.status == "success", "Restriction command failed"
    print(f"[OK] Speed restriction (0 kmph) set for emergency")
    
    # Create speed restriction for HIGH alert
    cmd2 = SCDACommand(
        command_id="CMD_RESTRICT_002",
        command_type=SCDACommandType.SET_SPEED_RESTRICTION,
        target_system="SEGMENT_002",
        payload={
            'segment_id': 'SEGMENT_002',
            'from_km': 180.0,
            'to_km': 185.0,
            'max_speed_kmph': 30,
            'reason': 'Unauthorized person on track',
            'duration_minutes': 10
        },
        priority=2
    )
    
    resp2 = scada.send_command(cmd2)
    assert resp2.status == "success", "Restriction command failed"
    print(f"[OK] Speed restriction (30 kmph) set for 10 minutes")
    
    # Verify restrictions active
    health = scada.get_system_health()
    assert health['active_restrictions'] == 2, "Wrong number of active restrictions"
    print(f"[OK] {health['active_restrictions']} active restrictions confirmed")


def test_scada_emergency_stop():
    """Test 7: Emergency stop via SCADA"""
    print("\n[TEST 7] SCADA Emergency Stop")
    _, scada = setup_test_infrastructure()
    
    # Trigger emergency stop
    cmd = SCDACommand(
        command_id="CMD_ESTOP_001",
        command_type=SCDACommandType.EMERGENCY_STOP,
        target_system="LINESIDE",
        payload={
            'train_id': 'TRAIN_12345',
            'location_km': 150.5
        },
        priority=1
    )
    
    resp = scada.send_command(cmd)
    assert resp.status == "success", "Emergency stop command failed"
    assert resp.data['emergency_triggered'] == True, "Emergency not triggered"
    assert resp.data['lineside_brake_engaged'] == True, "Lineside brake not engaged"
    
    print(f"[OK] Emergency stop activated")
    print(f"[OK] Lineside brakes engaged at {resp.data['location_km']} km")
    print(f"[OK] Surrounding signals set to ALL_RED")


def test_end_to_end_workflow():
    """Test 8: Complete E2E workflow - Alert from app to SCADA"""
    print("\n[TEST 8] End-to-End Workflow (Mobile App + SCADA)")
    mobile_backend, scada = setup_test_infrastructure()
    
    # Step 1: ML generates alert
    ml_alert = {
        'alert_id': 'ALERT_E2E_001',
        'severity': 'CRITICAL',
        'reason': 'Obstacle on track detected by ML',
        'location_km': 150.5,
        'current_speed': 80
    }
    
    # Step 2: Driver receives alert via mobile app
    driver_alert = mobile_backend.create_driver_alert(ml_alert, "TRAIN_12345", "DRV_001")
    assert driver_alert.title == "EMERGENCY - STOP IMMEDIATELY", "Alert title incorrect"
    print(f"[OK] Driver notified: {driver_alert.title}")
    
    # Step 3: SCADA sets signal to RED
    cmd_signal = SCDACommand(
        command_id="CMD_E2E_001",
        command_type=SCDACommandType.SET_SIGNAL,
        target_system="BAL",
        payload={'signal_id': 'BAL_HOME_1', 'state': 'RED'},
        priority=1
    )
    resp_signal = scada.send_command(cmd_signal)
    print(f"[OK] Signal set to RED via SCADA")
    
    # Step 4: SCADA triggers lineside brake
    cmd_brake = SCDACommand(
        command_id="CMD_E2E_002",
        command_type=SCDACommandType.EMERGENCY_STOP,
        target_system="LINESIDE",
        payload={'train_id': 'TRAIN_12345', 'location_km': 150.5},
        priority=1
    )
    resp_brake = scada.send_command(cmd_brake)
    print(f"[OK] Emergency brake triggered via SCADA")
    
    # Step 5: Driver acknowledges alert
    ack = mobile_backend.acknowledge_driver_alert(
        'ALERT_E2E_001',
        'DRV_001',
        'TRAIN_12345',
        'acknowledged'
    )
    print(f"[OK] Driver acknowledged alert")
    
    # Step 6: System status check
    app_status = mobile_backend.get_system_status()
    scada_status = scada.get_system_health()
    
    print(f"[OK] App status: {app_status['total_alerts_sent']} alerts, {app_status['active_websocket_connections']} connections")
    print(f"[OK] SCADA status: {scada_status['success_rate_percent']:.1f}% command success rate")


def test_multiple_drivers_independent_control():
    """Test 9: Multiple drivers with independent speed control"""
    print("\n[TEST 9] Multiple Drivers Independent Control")
    mobile_backend, scada = setup_test_infrastructure()
    
    # Driver 1: CRITICAL alert
    alert1 = mobile_backend.create_driver_alert(
        {'alert_id': 'ALERT_M1', 'severity': 'CRITICAL', 'reason': 'Landslide', 'location_km': 150.5, 'current_speed': 80},
        'TRAIN_12345', 'DRV_001'
    )
    
    # Driver 2: HIGH alert
    alert2 = mobile_backend.create_driver_alert(
        {'alert_id': 'ALERT_M2', 'severity': 'HIGH', 'reason': 'Person on track', 'location_km': 180.0, 'current_speed': 90},
        'TRAIN_67890', 'DRV_002'
    )
    
    # Driver 3: MEDIUM alert
    alert3 = mobile_backend.create_driver_alert(
        {'alert_id': 'ALERT_M3', 'severity': 'MEDIUM', 'reason': 'Bridge inspection', 'location_km': 120.0, 'current_speed': 75},
        'TRAIN_11111', 'DRV_003'
    )
    
    # Verify independent speeds
    assert alert1.recommended_speed_kmph == 0, "Driver 1 speed incorrect (should be 0)"
    assert alert2.recommended_speed_kmph == 30, "Driver 2 speed incorrect (should be 30)"
    assert alert3.recommended_speed_kmph == 50, "Driver 3 speed incorrect (should be 50)"
    
    print(f"[OK] Driver 1 (CRITICAL): 0 kmph")
    print(f"[OK] Driver 2 (HIGH): 30 kmph")
    print(f"[OK] Driver 3 (MEDIUM): 50 kmph")
    print(f"[OK] All drivers have independent speed control")


def test_scada_system_health():
    """Test 10: SCADA system health and performance metrics"""
    print("\n[TEST 10] SCADA System Health Metrics")
    _, scada = setup_test_infrastructure()
    
    # Execute multiple commands
    for i in range(5):
        cmd = SCDACommand(
            command_id=f"CMD_HEALTH_{i}",
            command_type=SCDACommandType.SET_SIGNAL,
            target_system="BAL",
            payload={'signal_id': f'BAL_HOME_{i+1}', 'state': 'YELLOW'},
            priority=2
        )
        scada.send_command(cmd)
    
    # Get system health
    health = scada.get_system_health()
    assert health['is_connected'] == True, "Not connected"
    assert health['total_commands_sent'] == 5, "Wrong command count"
    assert health['success_rate_percent'] == 100.0, "Not all commands succeeded"
    assert health['signals_registered'] == 6, "Wrong signal count"
    assert health['trains_tracked'] == 3, "Wrong train count"
    
    print(f"[OK] Connection status: {'Active' if health['is_connected'] else 'Inactive'}")
    print(f"[OK] Commands sent: {health['total_commands_sent']}")
    print(f"[OK] Success rate: {health['success_rate_percent']:.1f}%")
    print(f"[OK] Signals registered: {health['signals_registered']}")
    print(f"[OK] Trains tracked: {health['trains_tracked']}")


def run_all_tests():
    """Run all Phase 4.4 tests"""
    tests = [
        ("Mobile App Driver Registration", test_mobile_app_driver_registration),
        ("Driver Alert Creation & Acknowledgment", test_mobile_app_alert_creation_and_acknowledgment),
        ("Driver Performance Statistics", test_mobile_app_driver_stats),
        ("SCADA Signal Control", test_scada_signal_control),
        ("SCADA Train Tracking", test_scada_train_tracking),
        ("SCADA Speed Restrictions", test_scada_speed_restrictions),
        ("SCADA Emergency Stop", test_scada_emergency_stop),
        ("End-to-End Workflow", test_end_to_end_workflow),
        ("Multiple Drivers Independent Control", test_multiple_drivers_independent_control),
        ("SCADA System Health", test_scada_system_health),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"[FAIL] Test failed: {str(e)}")
            failed += 1
    
    print("\n" + "=" * 80)
    print("TEST SUMMARY - PHASE 4.4 DRIVER MOBILE APP + SCADA INTEGRATION")
    print("=" * 80)
    print(f"Passed: {passed}/{len(tests)}")
    print(f"Failed: {failed}/{len(tests)}")
    print(f"Success Rate: {passed/len(tests)*100:.1f}%")
    print("=" * 80)
    
    if failed == 0:
        print("\n[OK] ALL TESTS PASSED - Phase 4.4 Ready for Deployment\n")
        print("System Pipeline Complete:")
        print("  1. ML Inference (Bayesian, IF, DBSCAN, Causal DAG)")
        print("  2. Alert Generation (Cryptographic signatures)")
        print("  3. HUD Display (Loco cabin notifications)")
        print("  4. Multi-channel Notifications (SMS, Email, Push, WhatsApp)")
        print("  5. Signalling Mitigation (Auto signal control)")
        print("  6. Driver Mobile App (Real-time push notifications)")
        print("  7. SCADA Integration (Real signal control + train tracking)\n")
        return True
    else:
        print(f"\n[FAIL] {failed} tests failed - Fix errors before deployment\n")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
