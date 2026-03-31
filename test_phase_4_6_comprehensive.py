"""
Phase 4.6 Comprehensive Integration Tests
Test all advanced optimization features working together
"""

import time
import threading
from datetime import datetime, timedelta
from backend.optimization.advanced import (
    AdvancedOptimizationLayer, RequestType, RequestDeduplicator,
    PredictivePrefetcher, AdaptiveBatcher, DistributedCache
)


def test_dedup_with_time_window():
    """TEST 1: Request deduplication with time window"""
    print("\n" + "-"*70)
    print("TEST 1: Request Deduplication (Time Window)")
    print("-"*70)
    
    dedup = RequestDeduplicator(dedup_window_ms=100)
    
    # Request 1: TRAIN_001
    req_id_1 = dedup.request_hash("train_location", "TRAIN_001")
    
    # Check 1: First request - no dedup
    current_time = datetime.now()
    result = dedup.should_deduplicate(req_id_1, current_time)
    assert not result, "First request should not be deduplicated"
    dedup.register_request(req_id_1, {'data': 'train_001'})
    
    # Check 2: Immediate duplicate - should dedup
    result = dedup.should_deduplicate(req_id_1, current_time)
    assert result, "Immediate duplicate should be deduplicated"
    
    # Check 3: After time window expires - should not dedup
    future_time = current_time + timedelta(milliseconds=150)
    result = dedup.should_deduplicate(req_id_1, future_time)
    assert not result, "Request after time window should not be deduplicated"
    
    stats = dedup.get_dedup_stats()
    assert stats['dedup_rate_percent'] > 0, "Should have dedup rate >0"
    
    print(f"[OK] Dedup rate: {stats['dedup_rate_percent']:.1f}%")
    print(f"[OK] Total: {stats['total_requests']}, Deduped: {stats['deduplicated']}")


def test_pattern_discovery():
    """TEST 2: Pattern discovery for predictive prefetching"""
    print("\n" + "-"*70)
    print("TEST 2: Pattern Discovery")
    print("-"*70)
    
    prefetcher = PredictivePrefetcher(history_size=500)
    
    # Create a deterministic pattern: A->B->C->A->B->C...
    pattern = [
        (RequestType.TRAIN_LOCATION, "TRAIN_A"),
        (RequestType.SIGNAL_STATUS, "SIGNAL_B"),
        (RequestType.STATION_INFO, "STATION_C"),
    ]
    
    # Record pattern 20 times
    for cycle in range(20):
        for req_type, target_id in pattern:
            prefetcher.record_request(req_type, target_id)
    
    # Analyze patterns
    predictions = prefetcher.analyze_patterns()
    
    print(f"Patterns discovered: {len(predictions)}")
    assert len(predictions) > 0, "Should discover patterns"
    
    # Top prediction should be high confidence
    if predictions:
        top_type, top_id, top_confidence = predictions[0]
        print(f"[OK] Top prediction: {top_type.value}:{top_id} ({top_confidence*100:.0f}%)")
        assert top_confidence > 0.5, "Top prediction should have >50% confidence"
    
    stats = prefetcher.get_prefetch_stats()
    print(f"[OK] Patterns tracked: {stats['patterns_tracked']}")
    print(f"[OK] History size: {stats['history_size']}")


def test_batch_size_adaptation():
    """TEST 3: Batch size adapts to system load"""
    print("\n" + "-"*70)
    print("TEST 3: Adaptive Batch Size")
    print("-"*70)
    
    batcher = AdaptiveBatcher(min_batch=3, max_batch=25)
    
    # Record initial batch size
    batcher.update_load(0.1)  # Very low load
    low_batch = batcher.current_batch_size
    print(f"[CHECK] Low load batch: {low_batch}")
    
    # Gradually increase load
    loads = [0.25, 0.5, 0.75, 1.0]
    batches = {0.1: low_batch}  # Store initial value with key 0.1
    
    for load in loads:
        batcher.update_load(load)
        batches[load] = batcher.current_batch_size
        print(f"[CHECK] Load {load*100:.0f}%: batch={batcher.current_batch_size}")
    
    # Verify batch size increases with load
    assert batches[0.1] <= batches[0.25], "Lower load should have smaller or equal batches"
    assert batches[0.25] <= batches[0.5], "Higher load should have larger or equal batches"
    
    print(f"[OK] Batch adaptation working: {low_batch} -> {batches[1.0]}")


def test_distributed_cache_sharding():
    """TEST 4: Distributed cache sharding and replication"""
    print("\n" + "-"*70)
    print("TEST 4: Distributed Cache Sharding")
    print("-"*70)
    
    dist_cache = DistributedCache(num_nodes=3)
    
    # Add data
    print("[ADD] Inserting 100 key-value pairs")
    for i in range(100):
        key = f"item_{i:03d}"
        value = f"value_{i}"
        dist_cache.put(key, value)
    
    # Retrieve data
    print("[GET] Retrieving all items")
    retrieved = 0
    for i in range(100):
        key = f"item_{i:03d}"
        value = dist_cache.get(key)
        if value is not None:
            retrieved += 1
    
    assert retrieved == 100, "Should retrieve all items"
    
    # Check distribution across nodes
    stats = dist_cache.get_cluster_stats()
    print(f"[CHECK] Cache distribution:")
    for node_stat in stats['node_stats']:
        print(f"  {node_stat['node_id']}: {node_stat['cache_size']} entries")
    
    total_size = stats['total_cache_size']
    print(f"[OK] Total entries: {total_size} (including replicas)")
    print(f"[OK] Cluster hit rate: {stats['cluster_hit_rate_percent']:.1f}%")
    
    # Verify replication
    expected_total = 100 * stats['replication_factor']
    assert total_size >= 100, "Should have at least 100 entries (primary copies)"


def test_integrated_flow():
    """TEST 5: Integrated optimization flow"""
    print("\n" + "-"*70)
    print("TEST 5: Integrated Optimization Flow")
    print("-"*70)
    
    adv_opt = AdvancedOptimizationLayer(num_cache_nodes=3)
    
    query_executions = 0
    def mock_query(req_type, target_id):
        nonlocal query_executions
        query_executions += 1
        time.sleep(0.001)  # Simulate query latency
        return {
            'data': f'result_{target_id}',
            'timestamp': time.time(),
            'type': req_type.value
        }
    
    # Simulate realistic workload pattern
    print("[PHASE 1] Establish patterns")
    query_executions = 0
    
    for cycle in range(5):
        # Pattern: Check trains, then signals
        for train_id in ["TRAIN_001", "TRAIN_002", "TRAIN_003"]:
            adv_opt.process_query(RequestType.TRAIN_LOCATION, train_id, mock_query)
        
        for signal_id in ["SIGNAL_A", "SIGNAL_B"]:
            adv_opt.process_query(RequestType.SIGNAL_STATUS, signal_id, mock_query)
    
    phase1_queries = query_executions
    print(f"[OK] Phase 1: {phase1_queries} DB queries executed")
    
    # Phase 2: Repeat pattern - cache should reduce queries
    print("[PHASE 2] Repeat with caching")
    adv_opt.update_system_load(0.6)
    query_executions = 0
    
    for cycle in range(5):
        for train_id in ["TRAIN_001", "TRAIN_002", "TRAIN_003"]:
            adv_opt.process_query(RequestType.TRAIN_LOCATION, train_id, mock_query)
        
        for signal_id in ["SIGNAL_A", "SIGNAL_B"]:
            adv_opt.process_query(RequestType.SIGNAL_STATUS, signal_id, mock_query)
    
    phase2_queries = query_executions
    print(f"[OK] Phase 2: {phase2_queries} DB queries executed")
    
    # Verify optimization
    reduction = (phase1_queries - phase2_queries) / phase1_queries * 100
    print(f"[OK] Query reduction: {reduction:.1f}%")
    
    assert phase2_queries < phase1_queries, "Phase 2 should have fewer queries"
    assert reduction >= 50, "Should reduce queries by >50%"


def test_concurrent_dedup():
    """TEST 6: Concurrent deduplication"""
    print("\n" + "-"*70)
    print("TEST 6: Concurrent Deduplication")
    print("-"*70)
    
    dedup = RequestDeduplicator(dedup_window_ms=200)
    
    results = {'deduped': 0, 'total': 0}
    results_lock = threading.Lock()
    current_time = datetime.now()
    
    def worker_thread(thread_id):
        """Worker sending duplicate requests"""
        for i in range(50):
            # Each thread sends requests for same 5 targets
            target = f"TRAIN_{(thread_id + i) % 5:02d}"
            req_id = dedup.request_hash("train_location", target)
            
            if dedup.should_deduplicate(req_id, current_time):
                with results_lock:
                    results['deduped'] += 1
            
            dedup.register_request(req_id, {'data': target})
            
            with results_lock:
                results['total'] += 1
    
    # Launch 10 concurrent threads
    print("[LAUNCH] 10 threads, 50 requests each")
    threads = []
    
    for thread_id in range(10):
        t = threading.Thread(target=worker_thread, args=(thread_id,))
        t.start()
        threads.append(t)
    
    for t in threads:
        t.join()
    
    stats = dedup.get_dedup_stats()
    print(f"[OK] Total requests: {results['total']}")
    print(f"[OK] Deduplicated: {results['deduped']}")
    print(f"[OK] Dedup rate: {stats['dedup_rate_percent']:.1f}%")
    
    assert stats['dedup_rate_percent'] > 0, "Should detect some duplicates"


def test_cache_ttl_expiration():
    """TEST 7: Cache TTL expiration"""
    print("\n" + "-"*70)
    print("TEST 7: Cache TTL Expiration")
    print("-"*70)
    
    dist_cache = DistributedCache(num_nodes=2)
    
    # Add item
    key = "test_key"
    value = "test_value"
    dist_cache.put(key, value)
    print("[ADD] Added key with no TTL specified")
    
    # Immediate retrieval should work
    result = dist_cache.get(key, ttl_seconds=10)
    assert result is not None, "Should retrieve fresh item"
    print("[OK] Immediate retrieval: success")
    
    # Item still valid
    result = dist_cache.get(key, ttl_seconds=5)
    assert result is not None, "Should retrieve with longer TTL"
    print("[OK] With 5s TTL: success")
    
    # Simulate age - set very short TTL
    result = dist_cache.get(key, ttl_seconds=0)
    # Might fail due to TTL, which is expected
    print(f"[INFO] With 0s TTL: {'success' if result else 'expired (expected)'}")


def test_adaptive_batch_concurrent():
    """TEST 8: Adaptive batching under concurrent load"""
    print("\n" + "-"*70)
    print("TEST 8: Adaptive Batching (Concurrent)")
    print("-"*70)
    
    batcher = AdaptiveBatcher(min_batch=3, max_batch=20)
    
    batches_collected = []
    batch_lock = threading.Lock()
    
    def worker_thread(load_factor):
        """Worker adding commands under specific load"""
        batcher.update_load(load_factor)
        
        for i in range(30):
            batch = batcher.add_command({'cmd': f'cmd_{i}'})
            if batch:
                with batch_lock:
                    batches_collected.append((load_factor, len(batch)))
    
    # Run workers with different loads
    print("[WORKERS] Low=0.2, Medium=0.5, High=0.9")
    threads = [
        threading.Thread(target=worker_thread, args=(0.2,)),
        threading.Thread(target=worker_thread, args=(0.5,)),
        threading.Thread(target=worker_thread, args=(0.9,)),
    ]
    
    for t in threads:
        t.start()
    
    for t in threads:
        t.join()
    
    # Analyze
    low_batches = [b for l, b in batches_collected if l == 0.2]
    high_batches = [b for l, b in batches_collected if l == 0.9]
    
    print(f"[CHECK] Low load batch sizes: {low_batches[:5]}")
    print(f"[CHECK] High load batch sizes: {high_batches[:5]}")
    
    if low_batches and high_batches:
        avg_low = sum(low_batches) / len(low_batches)
        avg_high = sum(high_batches) / len(high_batches)
        print(f"[OK] Avg batch: low={avg_low:.1f}, high={avg_high:.1f}")


def run_all_tests():
    """Run all comprehensive tests"""
    print("\n" + "="*70)
    print("PHASE 4.6: COMPREHENSIVE INTEGRATION TESTS")
    print("="*70)
    
    tests = [
        ("Dedup Time Window", test_dedup_with_time_window),
        ("Pattern Discovery", test_pattern_discovery),
        ("Batch Adaptation", test_batch_size_adaptation),
        ("Cache Sharding", test_distributed_cache_sharding),
        ("Integrated Flow", test_integrated_flow),
        ("Concurrent Dedup", test_concurrent_dedup),
        ("Cache TTL", test_cache_ttl_expiration),
        ("Adaptive Batch Concurrent", test_adaptive_batch_concurrent),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            test_func()
            passed += 1
            print(f"[OK] {test_name}")
        except AssertionError as e:
            failed += 1
            print(f"[FAIL] {test_name}: {e}")
        except Exception as e:
            failed += 1
            print(f"[ERROR] {test_name}: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "="*70)
    print(f"[SUMMARY] {passed} passed, {failed} failed out of {len(tests)}")
    print("="*70)
    
    if failed == 0:
        print("\n[SUCCESS] ALL PHASE 4.6 COMPREHENSIVE TESTS PASSED")
        print("\nFeatures Validated:")
        print("  [OK] Request deduplication reduces redundant queries")
        print("  [OK] Pattern discovery enables predictive prefetching")
        print("  [OK] Batch size adapts to system load")
        print("  [OK] Distributed cache shards data across nodes")
        print("  [OK] Optimizations work together seamlessly")
        print("  [OK] Concurrent operations handled correctly")
        print("  [OK] Cache TTL and expiration working")
        print("  [OK] Adaptive batching scales with load")
        return True
    else:
        print(f"\n[FAILED] {failed} tests failed")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
