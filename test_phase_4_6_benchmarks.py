"""
Phase 4.6 Advanced Optimization Tests
Benchmarks for deduplication, prefetching, adaptive batching, and distributed caching
"""

import time
import threading
from datetime import datetime
from backend.optimization.advanced import (
    AdvancedOptimizationLayer, RequestType, RequestDeduplicator,
    PredictivePrefetcher, AdaptiveBatcher, DistributedCache
)


def benchmark_request_deduplication():
    """Benchmark 1: Request Deduplication"""
    print("\n" + "="*70)
    print("BENCHMARK 1: REQUEST DEDUPLICATION")
    print("="*70)
    
    dedup = RequestDeduplicator(dedup_window_ms=50)
    
    # Simulate rapid duplicate requests
    query_count = 100
    duplicate_requests = 0
    
    start = time.time()
    current_time = datetime.now()
    
    for i in range(query_count):
        # Requests 0-49: unique
        if i < 50:
            request_id = dedup.request_hash(f"query_{i}", str(i))
        # Requests 50-99: duplicates of first 50
        else:
            request_id = dedup.request_hash(f"query_{i % 50}", str(i % 50))
        
        if dedup.should_deduplicate(request_id, current_time):
            duplicate_requests += 1
        
        dedup.register_request(request_id, {'data': str(i)})
    
    elapsed = time.time() - start
    stats = dedup.get_dedup_stats()
    
    print(f"Total requests: {stats['total_requests']}")
    print(f"Deduplicated: {stats['deduplicated']}")
    print(f"Dedup rate: {stats['dedup_rate_percent']:.1f}%")
    print(f"Time: {elapsed*1000:.2f}ms")
    print(f"Throughput: {query_count/elapsed:.0f} req/s")
    
    assert stats['deduplicated'] >= 40  # Should catch most duplicates
    print("[OK] Deduplication test passed")


def benchmark_predictive_prefetching():
    """Benchmark 2: Predictive Prefetching"""
    print("\n" + "="*70)
    print("BENCHMARK 2: PREDICTIVE PREFETCHING")
    print("="*70)
    
    prefetcher = PredictivePrefetcher(history_size=1000)
    
    # Simulate request pattern: TRAIN_001 → SIGNAL_001 → TRAIN_002 → SIGNAL_002 (repeating)
    pattern = [
        (RequestType.TRAIN_LOCATION, "TRAIN_001"),
        (RequestType.SIGNAL_STATUS, "SIGNAL_001"),
        (RequestType.TRAIN_LOCATION, "TRAIN_002"),
        (RequestType.SIGNAL_STATUS, "SIGNAL_002"),
    ]
    
    # Record many cycles to establish pattern
    cycles = 50
    start = time.time()
    
    for cycle in range(cycles):
        for req_type, target_id in pattern:
            prefetcher.record_request(req_type, target_id)
    
    elapsed = time.time() - start
    
    # Analyze patterns
    predictions = prefetcher.analyze_patterns()
    
    print(f"Recorded {cycles*len(pattern)} requests in {elapsed*1000:.2f}ms")
    print(f"Patterns discovered: {len(predictions)}")
    print(f"Top predictions:")
    
    for i, (req_type, target_id, confidence) in enumerate(predictions[:5]):
        print(f"  {i+1}. {req_type.value}:{target_id} ({confidence*100:.0f}%)")
    
    stats = prefetcher.get_prefetch_stats()
    print(f"Total patterns tracked: {stats['patterns_tracked']}")
    
    assert len(predictions) > 0, "Should discover patterns"
    assert predictions[0][2] > 0.5, "Should have >50% confidence"
    print("[OK] Prefetching test passed")


def benchmark_adaptive_batching():
    """Benchmark 3: Adaptive Batching"""
    print("\n" + "="*70)
    print("BENCHMARK 3: ADAPTIVE BATCHING")
    print("="*70)
    
    batcher = AdaptiveBatcher(min_batch=3, max_batch=25)
    
    # Test 1: Low load scenario
    print("\n[LOW LOAD - 30% utilization]")
    batcher.update_load(0.3)
    
    batches_low = []
    for i in range(50):
        batch = batcher.add_command({'cmd': f'cmd_{i}'})
        if batch:
            batches_low.append(len(batch))
    
    low_stats = batcher.get_stats()
    print(f"Batch size: {low_stats['current_batch_size']}")
    print(f"Avg batch from history: {low_stats['recent_avg_batch']:.1f}")
    
    # Test 2: High load scenario
    print("\n[HIGH LOAD - 90% utilization]")
    batcher.update_load(0.9)
    
    batches_high = []
    for i in range(50):
        batch = batcher.add_command({'cmd': f'cmd_{i+50}'})
        if batch:
            batches_high.append(len(batch))
    
    high_stats = batcher.get_stats()
    print(f"Batch size: {high_stats['current_batch_size']}")
    print(f"Pending commands: {high_stats['pending_commands']}")
    
    print(f"\n[COMPARISON]")
    print(f"Low load batch: {low_stats['current_batch_size']}")
    print(f"High load batch: {high_stats['current_batch_size']}")
    print(f"Batch size changed: {high_stats['current_batch_size'] > low_stats['current_batch_size']}")
    
    assert high_stats['current_batch_size'] > low_stats['current_batch_size'], "High load should increase batch size"
    print("[OK] Adaptive batching test passed")


def benchmark_distributed_caching():
    """Benchmark 4: Distributed Caching"""
    print("\n" + "="*70)
    print("BENCHMARK 4: DISTRIBUTED CACHING (3 NODES)")
    print("="*70)
    
    dist_cache = DistributedCache(num_nodes=3)
    
    # Write phase
    print("\n[WRITE PHASE]: 300 keys across 3 nodes")
    start = time.time()
    
    for i in range(300):
        key = f"key_{i}"
        value = f"value_{i}"
        dist_cache.put(key, value)
    
    write_time = time.time() - start
    
    # Read phase 1 - cache hits
    print("[READ PHASE 1]: 300 reads (all should hit)")
    start = time.time()
    
    hits = 0
    for i in range(300):
        key = f"key_{i}"
        value = dist_cache.get(key, ttl_seconds=300)
        if value is not None:
            hits += 1
    
    read_phase1_time = time.time() - start
    
    # Read phase 2 - warm cache repeated reads
    print("[READ PHASE 2]: 300 repeated reads (warm cache)")
    start = time.time()
    
    warm_hits = 0
    for i in range(300):
        key = f"key_{(i % 50)}"  # Only read keys 0-49 again (warm cache)
        value = dist_cache.get(key, ttl_seconds=300)
        if value is not None:
            warm_hits += 1
    
    read_phase2_time = time.time() - start
    
    # Statistics
    stats = dist_cache.get_cluster_stats()
    
    print(f"\nWrite throughput: {300/write_time:.0f} ops/s")
    print(f"Read throughput (first pass): {hits/read_phase1_time:.0f} ops/s")
    print(f"Read throughput (warm cache): {warm_hits/read_phase2_time:.0f} ops/s")
    
    print(f"\nCluster Statistics:")
    print(f"  Total nodes: {stats['num_nodes']}")
    print(f"  Replication factor: {stats['replication_factor']}")
    print(f"  Total cache size: {stats['total_cache_size']} entries")
    print(f"  Total hits: {stats['total_hits']}")
    print(f"  Total misses: {stats['total_misses']}")
    print(f"  Cluster hit rate: {stats['cluster_hit_rate_percent']:.1f}%")
    
    print(f"\nNode Distribution:")
    for node_stat in stats['node_stats']:
        print(f"  {node_stat['node_id']}: {node_stat['cache_size']} entries, "
              f"{node_stat['hit_rate_percent']:.1f}% hit rate")
    
    # Verify: most reads should hit (>300/300 = 100% first phase + >50 hits in second phase)
    first_phase_success = hits >= 300
    second_phase_success = warm_hits > 45
    
    assert first_phase_success, f"First phase should hit all items: {hits}/300"
    assert second_phase_success, f"Second phase should hit warm items: {warm_hits}/300"
    print("[OK] Distributed caching test passed")


def benchmark_integrated_optimization():
    """Benchmark 5: Fully Integrated Optimization Layer"""
    print("\n" + "="*70)
    print("BENCHMARK 5: FULLY INTEGRATED OPTIMIZATION LAYER")
    print("="*70)
    
    adv_opt = AdvancedOptimizationLayer(num_cache_nodes=3)
    
    # Mock query function
    query_count = 0
    def mock_query(req_type, target_id):
        nonlocal query_count
        query_count += 1
        time.sleep(0.001)
        return {'data': f'result_{target_id}', 'timestamp': time.time()}
    
    # Simulate realistic workload
    print("\n[PHASE 1] Initial queries - no optimization")
    start = time.time()
    query_count = 0
    
    for i in range(100):
        train_id = f"TRAIN_{(i % 20):03d}"
        result = adv_opt.process_query(RequestType.TRAIN_LOCATION, train_id, mock_query)
    
    phase1_time = time.time() - start
    phase1_queries = query_count
    
    print(f"Time: {phase1_time*1000:.2f}ms")
    print(f"Actual DB queries: {phase1_queries}")
    
    # Simulate more queries - cache should be warm
    print("\n[PHASE 2] Repeated queries - optimization active")
    adv_opt.update_system_load(0.5)
    
    start = time.time()
    query_count = 0
    
    for i in range(100):
        train_id = f"TRAIN_{(i % 20):03d}"
        result = adv_opt.process_query(RequestType.TRAIN_LOCATION, train_id, mock_query)
    
    phase2_time = time.time() - start
    phase2_queries = query_count
    
    print(f"Time: {phase2_time*1000:.2f}ms")
    print(f"Actual DB queries: {phase2_queries}")
    
    # Get comprehensive stats
    stats = adv_opt.get_optimization_stats()
    
    print(f"\n[OPTIMIZATION STATISTICS]")
    print(f"Total requests: {stats['requests_processed']}")
    print(f"Dedup savings: {stats['dedup_savings']} ({stats['dedup_rate_percent']:.1f}%)")
    
    print(f"\nDeduplicator:")
    print(f"  Total: {stats['deduplicator']['total_requests']}")
    print(f"  Deduplicated: {stats['deduplicator']['deduplicated']}")
    
    print(f"\nPrefetcher:")
    print(f"  Patterns: {stats['prefetcher']['patterns_tracked']}")
    print(f"  Hit rate: {stats['prefetcher']['hit_rate_percent']:.1f}%")
    
    print(f"\nAdaptive Batcher:")
    print(f"  Batch size: {stats['adaptive_batcher']['current_batch_size']}")
    print(f"  Load factor: {stats['adaptive_batcher']['load_factor']:.1f}")
    
    speedup = phase1_time / phase2_time if phase2_time > 0 else 0
    query_reduction = (phase1_queries - phase2_queries) / phase1_queries * 100 if phase1_queries > 0 else 0
    
    print(f"\n[IMPACT]")
    print(f"Overall speedup: {speedup:.2f}x")
    print(f"Query reduction: {query_reduction:.1f}%")
    
    # Key validation: deduplication should be >30%, and query reduction should be >50%
    assert stats['dedup_rate_percent'] >= 30, f"Should dedup >30%, got {stats['dedup_rate_percent']:.1f}%"
    assert query_reduction >= 50, f"Should reduce queries >50%, got {query_reduction:.1f}%"
    print("[OK] Integrated optimization test passed")


def benchmark_concurrent_load():
    """Benchmark 6: Concurrent Load with All Optimizations"""
    print("\n" + "="*70)
    print("BENCHMARK 6: CONCURRENT LOAD (50 THREADS)")
    print("="*70)
    
    adv_opt = AdvancedOptimizationLayer(num_cache_nodes=3)
    
    results = {'success': 0, 'error': 0, 'latencies': []}
    results_lock = threading.Lock()
    
    def worker_thread(thread_id, num_ops):
        """Worker thread executing queries"""
        def mock_query(req_type, target_id):
            time.sleep(0.001)
            return {'data': f'result_{target_id}'}
        
        for i in range(num_ops):
            try:
                train_id = f"TRAIN_{(thread_id + i) % 100:03d}"
                
                start = time.time()
                result = adv_opt.process_query(RequestType.TRAIN_LOCATION, train_id, mock_query)
                latency = (time.time() - start) * 1000
                
                with results_lock:
                    results['success'] += 1
                    results['latencies'].append(latency)
            except Exception as e:
                with results_lock:
                    results['error'] += 1
    
    # Launch concurrent threads
    print("\n[LAUNCHING] 50 concurrent threads, 20 ops each")
    threads = []
    start = time.time()
    
    for thread_id in range(50):
        t = threading.Thread(target=worker_thread, args=(thread_id, 20))
        t.start()
        threads.append(t)
    
    # Wait for completion
    for t in threads:
        t.join()
    
    elapsed = time.time() - start
    
    # Analysis
    latencies = sorted(results['latencies'])
    p50 = latencies[len(latencies)//2] if latencies else 0
    p95 = latencies[int(len(latencies)*0.95)] if latencies else 0
    p99 = latencies[int(len(latencies)*0.99)] if latencies else 0
    
    print(f"\n[RESULTS]")
    print(f"Operations: {results['success']} successful, {results['error']} errors")
    print(f"Total time: {elapsed:.2f}s")
    print(f"Throughput: {results['success']/elapsed:.0f} ops/s")
    
    print(f"\n[LATENCY PERCENTILES]")
    print(f"P50: {p50:.2f}ms")
    print(f"P95: {p95:.2f}ms")
    print(f"P99: {p99:.2f}ms")
    
    stats = adv_opt.get_optimization_stats()
    print(f"\n[OPTIMIZATION IMPACT]")
    print(f"Cache hit rate: {stats['distributed_cache']['cluster_hit_rate_percent']:.1f}%")
    print(f"Dedup rate: {stats['dedup_rate_percent']:.1f}%")
    
    assert results['success'] > 900, "Should have >900 successful ops"
    assert p99 < 50, "P99 latency should be <50ms"
    print("[OK] Concurrent load test passed")


def run_all_benchmarks():
    """Run all benchmarks"""
    print("\n" + "="*70)
    print("PHASE 4.6: ADVANCED OPTIMIZATION BENCHMARKS")
    print("="*70)
    
    try:
        benchmark_request_deduplication()
        benchmark_predictive_prefetching()
        benchmark_adaptive_batching()
        benchmark_distributed_caching()
        benchmark_integrated_optimization()
        benchmark_concurrent_load()
        
        print("\n" + "="*70)
        print("[SUCCESS] ALL PHASE 4.6 BENCHMARKS PASSED")
        print("="*70)
        print("\nKey Improvements from Phase 4.5:")
        print("  ✓ Request deduplication: Prevents duplicate query storms")
        print("  ✓ Predictive prefetching: Proactively loads likely queries")
        print("  ✓ Adaptive batching: Scales batch size to system load")
        print("  ✓ Distributed caching: Scales horizontally across nodes")
        
    except AssertionError as e:
        print(f"\n[FAILED] {e}")
        return False
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True


if __name__ == "__main__":
    success = run_all_benchmarks()
    exit(0 if success else 1)
