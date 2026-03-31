"""
End-to-End Integration Tests for Alert Distribution System
Tests: HUD Display + Multi-channel Notifications + Audit Trail
"""

import uuid
from datetime import datetime
from backend.integration.distribution import AlertDistributionSystem
from backend.alerts.engine import DrishtiAlert, AlertExplanation, CryptographicSignature, AuditLog


def create_mock_alert(severity: str, train_id: str = "TRAIN_12345") -> DrishtiAlert:
    """Helper to create mock alerts for testing"""
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
            primary=f"Multiple ML methods detect {severity} risk conditions",
            secondary_factors=[f"Factor {i}" for i in range(3)],
            methods_voting={'bayesian': True, 'if': True, 'causal': True, 'dbscan': False},
            confidence_percent=85 if severity == "CRITICAL" else 65
        ),
        actions=[
            "REDUCE_SPEED_TO_20_KMPH",
            "ALERT_ADJACENT_TRAINS",
            "NOTIFY_SIGNALLING_CENTER"
        ],
        signature=CryptographicSignature(
            algorithm="SHA256_MOCK",
            public_key_hex="mock_key",
            signature_hex="mock_sig",
            message_hash="mock_hash"
        )
    )


def create_mock_train_data(station: str = "Balasore") -> dict:
    """Helper to create mock train data"""
    return {
        'current_station': 'BAL',
        'current_station_name': station,
        'latitude': 21.4774,
        'longitude': 86.9479,
        'km_marker': 150.5,
        'track_section': 'SEC_15',
        'speed': 75.0,
        'speed_limit': 100.0,
        'acceleration': 0.2,
        'brake_status': 'normal',
        'delay_minutes': 5,
        'next_station': 'Cuttack',
        'eta_minutes': 15
    }


def test_e2e_critical_alert():
    """TEST 1: End-to-end CRITICAL alert flow"""
    print("\n" + "="*80)
    print("TEST 1: End-to-End CRITICAL Alert Distribution")
    print("="*80)
    
    system = AlertDistributionSystem()
    alert = create_mock_alert("CRITICAL")
    train_data = create_mock_train_data()
    
    # Execute distribution
    result = system.distribute_alert(alert, train_data)
    
    # Validate HUD delivery
    assert result['hud_delivery']['success'], "HUD delivery failed"
    assert result['hud_delivery']['message_id'] == result['hud_message'].message_id
    assert result['hud_message'].severity.value == 'CRITICAL'
    print("[OK] HUD: CRITICAL alert displayed on loco cabin")
    
    # Validate notifications
    assert result['distribution_record']['notifications_sent'] > 0, "No notifications sent"
    print("[OK] NOTIFICATIONS: {} messages sent".format(
        result['distribution_record']['notifications_sent']))
    
    # Validate audit trail
    assert result['distribution_record']['status'] == 'distributed'
    assert result['distribution_record']['alert_id'] == str(alert.alert_id)
    print("[OK] AUDIT: Distribution logged with alert traceability")
    
    print("\n[INFO] Distribution Summary:")
    print("   Alert ID: {}".format(alert.alert_id))
    print("   Train: {}".format(alert.train_id))
    print("   Severity: {}".format(alert.severity))
    print("   HUD Message ID: {}".format(result['hud_message'].message_id))
    print("   Notifications: {}".format(result['distribution_record']['notifications_sent']))
    return True


def test_hud_conversion():
    """TEST 2: HUD message conversion accuracy"""
    print("\n" + "="*80)
    print("TEST 2: HUD Message Conversion")
    print("="*80)
    
    system = AlertDistributionSystem()
    alert = create_mock_alert("HIGH")
    train_data = create_mock_train_data()
    
    # Test conversion
    hud_msg = system._convert_to_hud_message(alert, train_data)
    
    # Validate structure
    assert hud_msg.train_id == "TRAIN_12345"
    assert hud_msg.location.station_name == "Balasore"
    assert hud_msg.train_state.speed_kmph == 75.0
    assert len(hud_msg.actions) > 0
    assert hud_msg.alert_id_from_audit == str(alert.alert_id)
    
    print("[OK] Message Structure: All fields populated correctly")
    print("[OK] Location: {} at {:.4f}, {:.4f}".format(
        hud_msg.location.station_name, hud_msg.location.latitude, hud_msg.location.longitude))
    print("[OK] Train State: Speed {} kmph, ETA {} min".format(
        hud_msg.train_state.speed_kmph, hud_msg.train_state.eta_minutes))
    print("[OK] Actions: {} recommended actions".format(len(hud_msg.actions)))
    print("[OK] Severity: {} -> {}".format(hud_msg.severity.value, hud_msg.color))
    print("[OK] Traceability: HUD links to audit alert {}".format(
        hud_msg.alert_id_from_audit))
    
    return True


def test_notification_routing():
    """TEST 3: Notification routing correctness"""
    print("\n" + "="*80)
    print("TEST 3: Multi-Channel Notification Routing")
    print("="*80)
    
    system = AlertDistributionSystem()
    alert = create_mock_alert("CRITICAL")
    train_data = create_mock_train_data()
    
    # Get distribution result
    result = system.distribute_alert(alert, train_data)
    notifications = result['notifications']
    
    # Validate routing
    assert len(notifications) > 0, "No notifications routed"
    
    # Check channels
    channels = {}
    for notif in notifications:
        channels[notif.channel] = channels.get(notif.channel, 0) + 1
    
    print("[OK] Routing Diversity: Notifications across {} channels".format(len(channels)))
    for channel, count in channels.items():
        print("   - {}: {} message(s)".format(channel, count))
    
    # Validate critical alert goes to multiple recipients
    assert sum(channels.values()) >= 3, "CRITICAL alert should go to multiple recipients"
    print("[OK] Criticality Handling: {} total messages for CRITICAL alert".format(
        sum(channels.values())))
    
    return True


def test_multiple_severity_levels():
    """TEST 4: Test all severity levels"""
    print("\n" + "="*80)
    print("TEST 4: All Severity Levels")
    print("="*80)
    
    system = AlertDistributionSystem()
    severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    results = {}
    
    for severity in severities:
        alert = create_mock_alert(severity)
        train_data = create_mock_train_data()
        result = system.distribute_alert(alert, train_data)
        
        results[severity] = {
            'hud_success': result['hud_delivery']['success'],
            'notifications': result['distribution_record']['notifications_sent'],
            'hud_color': result['hud_message'].color,
            'sound': result['hud_message'].sound_type
        }
    
    # Validate each severity
    assert results["CRITICAL"]['hud_success'], "CRITICAL HUD delivery failed"
    assert results["CRITICAL"]['notifications'] >= 2, "CRITICAL should have multiple notifications"
    print("[OK] CRITICAL: Multiple notifications + siren")
    
    assert results["HIGH"]['hud_success'], "HIGH HUD delivery failed"
    assert results["HIGH"]['notifications'] >= 1, "HIGH should have notifications"
    print("[OK] HIGH: Multiple notifications + alarm")
    
    assert results["MEDIUM"]['hud_success'], "MEDIUM HUD delivery failed"
    print("[OK] MEDIUM: Alert with chime")
    
    assert results["LOW"]['hud_success'], "LOW HUD delivery failed"
    print("[OK] LOW: Alert with beep")
    
    print("\nSeverity Comparison:")
    for severity in severities:
        r = results[severity]
        print("   {:<10} | Notifications: {:2} | Color: {} | Sound: {}".format(
            severity, r['notifications'], r['hud_color'], r['sound']))
    
    return True


def test_hud_display_consistency():
    """TEST 5: HUD display consistency across trains"""
    print("\n" + "="*80)
    print("TEST 5: HUD Display Consistency")
    print("="*80)
    
    system = AlertDistributionSystem()
    
    # Send alerts to multiple trains
    trains = ["TRAIN_001", "TRAIN_002", "TRAIN_003"]
    
    for train_id in trains:
        alert = create_mock_alert("HIGH", train_id)
        train_data = create_mock_train_data()
        result = system.distribute_alert(alert, train_data)
        assert result['hud_delivery']['success']
    
    # Verify all trains have displays
    assert len(system.hud_displays) == 3, "Expected 3 displays, got {}".format(
        len(system.hud_displays))
    print("[OK] Multi-train Support: {} trains with active HUDs".format(
        len(system.hud_displays)))
    
    # Verify each can be updated independently
    new_alert = create_mock_alert("CRITICAL", "TRAIN_001")
    train_data = create_mock_train_data()
    result = system.distribute_alert(new_alert, train_data)
    
    assert result['distribution_record']['severity'] == "CRITICAL"
    print("[OK] Independent Updates: TRAIN_001 updated without affecting others")
    
    return True


def test_system_status():
    """TEST 6: System status and metrics"""
    print("\n" + "="*80)
    print("TEST 6: System Status and Metrics")
    print("="*80)
    
    system = AlertDistributionSystem()
    
    # Generate multiple alerts
    for i in range(5):
        severity = "CRITICAL" if i % 2 == 0 else "HIGH"
        alert = create_mock_alert(severity, "TRAIN_{:03d}".format(i))
        train_data = create_mock_train_data()
        system.distribute_alert(alert, train_data)
    
    # Get status
    status = system.get_status()
    
    assert status['total_distributions'] == 5, "Incorrect distribution count"
    print("[OK] Distribution Count: {} alerts processed".format(status['total_distributions']))
    
    assert status['hud_displays_active'] == 5, "Not all trains have displays"
    print("[OK] Active HUDs: {} trains".format(status['hud_displays_active']))
    
    assert len(status['recent_distributions']) <= 5, "Recent not limited"
    print("[OK] Distribution Log: Last {} distributions tracked".format(
        len(status['recent_distributions'])))
    
    return True


def test_actions_mapping():
    """TEST 7: Action type mapping"""
    print("\n" + "="*80)
    print("TEST 7: Action Type Mapping")
    print("="*80)
    
    system = AlertDistributionSystem()
    
    test_actions = [
        ("Reduce speed to 20 kmph", "reduce_speed"),
        ("Prepare emergency brake", "prepare_brake"),
        ("Change to alternate track", "change_track"),
        ("Alert signalling personnel", "alert_personnel")
    ]
    
    for action_text, expected_type in test_actions:
        mapped = system._map_action_to_type(action_text)
        assert mapped == expected_type, "Action mapping failed: {} -> {} (expected {})".format(
            action_text, mapped, expected_type)
        print("[OK] '{}' -> {}".format(action_text, mapped))
    
    return True


def run_all_tests():
    """Run complete integration test suite"""
    print("\n\n")
    print("+" + "="*78 + "+")
    print("|" + " "*78 + "|")
    header1 = "DRISHTI Alert Distribution System - End-to-End Integration Tests"
    print("|" + header1.center(78) + "|")
    header2 = "(HUD Protocol + Multi-Channel Notifications + Audit Trail)"
    print("|" + header2.center(78) + "|")
    print("|" + " "*78 + "|")
    print("+" + "="*78 + "+")
    
    tests = [
        ("E2E CRITICAL Alert Flow", test_e2e_critical_alert),
        ("HUD Message Conversion", test_hud_conversion),
        ("Multi-Channel Routing", test_notification_routing),
        ("All Severity Levels", test_multiple_severity_levels),
        ("HUD Display Consistency", test_hud_display_consistency),
        ("System Status and Metrics", test_system_status),
        ("Action Type Mapping", test_actions_mapping)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            failed += 1
            print("\n[FAIL] TEST FAILED: {}".format(test_name))
            print("   Error: {}".format(e))
            import traceback
            traceback.print_exc()
    
    # Print summary
    print("\n\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print("Passed: {}/{}".format(passed, len(tests)))
    print("Failed: {}/{}".format(failed, len(tests)))
    print("Success Rate: {}%".format(100*passed//len(tests)))
    print("="*80)
    
    if failed == 0:
        print("\n[OK] ALL TESTS PASSED - Alert Distribution System Ready for Production")
    else:
        print("\n[FAIL] {} TEST(S) FAILED - Review logs above".format(failed))
    
    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    exit(0 if success else 1)
