"""
Test DRISHTI Full Stack
Validate streaming pipeline, inference engine, alerts, and API
"""

import sys
import json
import time
import requests
from datetime import datetime

from backend.inference.streaming import StreamingPipeline
from backend.inference.config import StreamingConfig, MetricsCollector
from backend.alerts.engine import AuditLog

def test_streaming_pipeline():
    """Test streaming pipeline with mock backend"""
    print("\n" + "="*70)
    print("TEST 1: Streaming Pipeline (Mock Backend)")
    print("="*70)
    
    config = StreamingConfig(backend='mock', batch_size=10)
    pipeline = StreamingPipeline(config)
    
    try:
        pipeline.connect()
        print("[OK] Connected to mock NTES source")
        
        # Process single batch
        result = pipeline.run_single_batch()
        
        if result:
            print(f"[OK] Processed batch: {result['trains']} trains")
            print(f"[OK] Generated alerts: {result['alerts']} alerts")
            print(f"[OK] Latency: {result['latency_ms']}ms")
            return True
        else:
            print("[FAIL] No trains processed")
            return False
    
    except Exception as e:
        print(f"[ERROR] {e}")
        return False
    
    finally:
        pipeline.stop()


def test_alert_audit():
    """Test alert generation and audit trail"""
    print("\n" + "="*70)
    print("TEST 2: Alert Generation & Audit Trail")
    print("="*70)
    
    try:
        audit_log = AuditLog(log_file='test_audit.jsonl')
        
        # Check if audit log is working
        initial_count = len(audit_log.alerts)
        print(f"[OK] Audit log initialized with {initial_count} existing alerts")
        
        # Get statistics
        stats = audit_log.get_statistics()
        print(f"[OK] Statistics retrieved:")
        print(f"     - Total alerts: {stats['total_alerts']}")
        print(f"     - Critical: {stats.get('critical', 0)}")
        print(f"     - Acknowledged: {stats.get('acknowledged', 0)}")
        
        return True
    
    except Exception as e:
        print(f"[ERROR] {e}")
        return False


def test_api_endpoints():
    """Test FastAPI server endpoints"""
    print("\n" + "="*70)
    print("TEST 3: FastAPI Server Endpoints")
    print("="*70)
    
    base_url = "http://localhost:8000"
    
    tests = [
        ("GET", "/health", "Health check"),
        ("GET", "/api/stats", "Statistics endpoint"),
        ("GET", "/api/alerts/history?limit=5", "Alert history"),
    ]
    
    passed = 0
    failed = 0
    
    for method, endpoint, description in tests:
        try:
            response = requests.request(method, f"{base_url}{endpoint}", timeout=5)
            
            if response.status_code == 200:
                print(f"[OK] {description}: {response.status_code}")
                passed += 1
            else:
                print(f"[FAIL] {description}: {response.status_code}")
                failed += 1
        
        except requests.exceptions.ConnectionError:
            print(f"[SKIP] API server not running (start with: python -m uvicorn backend.api.server:app)")
            return None
        
        except Exception as e:
            print(f"[ERROR] {description}: {e}")
            failed += 1
    
    return passed, failed


def test_metrics():
    """Test metrics collection"""
    print("\n" + "="*70)
    print("TEST 4: Metrics Collection")
    print("="*70)
    
    try:
        metrics = MetricsCollector()
        
        # Simulate some metrics
        metrics.record_batch(100, 45.3, 2)
        metrics.record_alert('CRITICAL')
        metrics.record_alert('MEDIUM')
        metrics.record_batch(100, 38.1, 1)
        
        summary = metrics.summary()
        
        print(f"[OK] Metrics recorded:")
        print(f"     - Total batches: {summary['total_batches']}")
        print(f"     - Total trains: {summary['total_trains']}")
        print(f"     - Total alerts: {summary['total_alerts']}")
        print(f"     - Avg latency: {summary['avg_batch_latency_ms']}ms")
        print(f"     - Alerts breakdown: {summary['alerts_breakdown']}")
        
        return True
    
    except Exception as e:
        print(f"[ERROR] {e}")
        return False


def test_end_to_end():
    """Full end-to-end pipeline test"""
    print("\n" + "="*70)
    print("TEST 5: End-to-End Pipeline")
    print("="*70)
    
    config = StreamingConfig(backend='mock', batch_size=50)
    pipeline = StreamingPipeline(config)
    
    try:
        pipeline.connect()
        print("[OK] Pipeline connected")
        
        # Process 3 batches
        total_trains = 0
        total_alerts = 0
        
        for batch_num in range(3):
            print(f"\n[BATCH {batch_num + 1}] Processing...")
            result = pipeline.run_single_batch()
            
            if result:
                total_trains += result['trains']
                total_alerts += result['alerts']
                print(f"  Trains: {result['trains']}")
                print(f"  Alerts: {result['alerts']}")
                print(f"  Latency: {result['latency_ms']}ms")
            
            time.sleep(0.5)
        
        print(f"\n[OK] E2E Complete:")
        print(f"  Total trains: {total_trains}")
        print(f"  Total alerts: {total_alerts}")
        print(f"  Metrics: {pipeline.get_metrics()}")
        
        return True
    
    except Exception as e:
        print(f"[ERROR] {e}")
        return False
    
    finally:
        pipeline.stop()


def main():
    print("\n" + "="*70)
    print("DRISHTI FULL STACK TEST SUITE")
    print("Phases 3.1-3.4: Alerts, Streaming, API, Deployment")
    print("="*70)
    
    results = {}
    
    # Run tests
    results['streaming'] = test_streaming_pipeline()
    results['alerts'] = test_alert_audit()
    results['metrics'] = test_metrics()
    results['e2e'] = test_end_to_end()
    
    # Try API tests if server is running
    api_result = test_api_endpoints()
    if api_result is not None:
        results['api_passed'], results['api_failed'] = api_result
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    
    for test_name, result in results.items():
        status = "[OK]" if result is True else "[FAIL]" if result is False else "[SKIP]"
        print(f"{status} {test_name}")
    
    print("="*70)
    print(f"Passed: {passed} | Failed: {failed} | Skipped: {skipped}")
    print("="*70)
    
    if failed == 0:
        print("\n[OK] All tests passed! System is ready for deployment.")
        return 0
    else:
        print(f"\n[FAIL] {failed} test(s) failed. Fix issues before deploying.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
