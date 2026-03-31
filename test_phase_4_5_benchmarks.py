"""
DRISHTI Phase 4.5: Performance Benchmark Tests
Compare optimized vs non-optimized operations
"""

import sys
import time
from datetime import datetime
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.driver.mobile_app import DriverMobileAppBackend, MobileDriver
from backend.scada.connector import SCDAConnector, SCDAVendor, SCDACommand, SCDACommandType
from backend.performance.optimizer import (
    OptimizedSCADAConnector, NTESCacheLayer, PerformanceCache, 
    ConnectionPool, CommandBatcher
)


class BenchmarkComparison:
    """Compare performance: baseline vs optimized"""
    
    def __init__(self):
        self.baseline_times = []
        self.optimized_times = []
        self.scada_baseline = SCDAConnector(SCDAVendor.NATIVE_IR)
        self.scada_optimized = OptimizedSCADAConnector()
        self.scada_baseline.authenticate("admin", "password", "https://scada.ir.gov.in")
        
        # Setup
        for i in range(50):
            self.scada_baseline.register_signal(f"SIG_{i:04d}", f"STN_{i%10:02d}", "home")
        for i in range(20):
            self.scada_baseline.register_train(f"TRAIN_{i:04d}", 100 + i*10, 80)
    
    def benchmark_signal_command_baseline(self, iterations: int = 100) -> Dict:
        """Benchmark baseline signal command"""
        times = []
        
        for i in range(iterations):
            start = time.time()
            
            cmd = SCDACommand(
                command_id=f"CMD_{i}",
                command_type=SCDACommandType.SET_SIGNAL,
                target_system="SCADA",
                payload={'signal_id': f"SIG_{i%50:04d}", 'state': 'RED'},
                priority=1
            )
            self.scada_baseline.send_command(cmd)
            
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)
        
        return {
            'min': min(times),
            'max': max(times),
            'avg': sum(times) / len(times),
            'total': sum(times),
            'operations': iterations
        }
    
    def benchmark_signal_command_optimized(self, iterations: int = 100) -> Dict:
        """Benchmark optimized signal command"""
        times = []
        
        for i in range(iterations):
            start = time.time()
            
            self.scada_optimized.execute_signal_command_optimized(
                f"SIG_{i%50:04d}",
                'RED'
            )
            
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)
        
        return {
            'min': min(times),
            'max': max(times),
            'avg': sum(times) / len(times),
            'total': sum(times),
            'operations': iterations
        }
    
    def benchmark_train_query_baseline(self, iterations: int = 100) -> Dict:
        """Benchmark baseline train query"""
        times = []
        
        for i in range(iterations):
            start = time.time()
            
            cmd = SCDACommand(
                command_id=f"QUERY_{i}",
                command_type=SCDACommandType.QUERY_TRAIN_LOCATION,
                target_system="NTES",
                payload={'train_id': f"TRAIN_{i%20:04d}"},
                priority=2
            )
            self.scada_baseline.send_command(cmd)
            
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)
        
        return {
            'min': min(times),
            'max': max(times),
            'avg': sum(times) / len(times),
            'total': sum(times),
            'operations': iterations
        }
    
    def benchmark_train_query_optimized(self, iterations: int = 100) -> Dict:
        """Benchmark optimized train query with caching"""
        times = []
        
        for i in range(iterations):
            start = time.time()
            
            self.scada_optimized.execute_train_query_optimized(
                f"TRAIN_{i%20:04d}"
            )
            
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)
        
        return {
            'min': min(times),
            'max': max(times),
            'avg': sum(times) / len(times),
            'total': sum(times),
            'operations': iterations
        }
    
    def benchmark_cache_performance(self, iterations: int = 1000) -> Dict:
        """Benchmark cache hit vs miss"""
        cache = PerformanceCache(max_size=100)
        
        # Populate cache
        for i in range(50):
            cache.put(f"key_{i}", f"value_{i}", ttl_seconds=30)
        
        hit_times = []
        miss_times = []
        
        for i in range(iterations):
            if i % 2 == 0:
                # Cache hit (repeat key)
                start = time.time()
                cache.get(f"key_{i%50}")
                hit_times.append((time.time() - start) * 1_000_000)  # microseconds
            else:
                # Cache miss (new key)
                start = time.time()
                cache.get(f"new_key_{i}")
                miss_times.append((time.time() - start) * 1_000_000)
        
        return {
            'cache_hits': {
                'count': len(hit_times),
                'avg_micros': sum(hit_times) / len(hit_times) if hit_times else 0,
                'min_micros': min(hit_times) if hit_times else 0,
                'max_micros': max(hit_times) if hit_times else 0
            },
            'cache_misses': {
                'count': len(miss_times),
                'avg_micros': sum(miss_times) / len(miss_times) if miss_times else 0,
                'min_micros': min(miss_times) if miss_times else 0,
                'max_micros': max(miss_times) if miss_times else 0
            }
        }
    
    def benchmark_connection_pool(self, iterations: int = 100) -> Dict:
        """Benchmark connection pool reuse"""
        pool = ConnectionPool(pool_size=10)
        
        times = []
        for i in range(iterations):
            start = time.time()
            
            conn = pool.acquire_connection()
            # Use connection
            time.sleep(0.001)  # Simulate work
            pool.release_connection(conn)
            
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)
        
        return {
            'operations': iterations,
            'avg_ms': sum(times) / len(times),
            'min_ms': min(times),
            'max_ms': max(times),
            'pool_stats': pool.get_stats()
        }
    
    def benchmark_command_batching(self, iterations: int = 100) -> Dict:
        """Benchmark command batching efficiency"""
        batcher = CommandBatcher(batch_size=10, batch_timeout_ms=50)
        
        batch_count = 0
        command_count = 0
        batch_times = []
        
        for i in range(iterations):
            start = time.time()
            
            batch = batcher.add_command({'cmd': f'command_{i}'})
            if batch:
                batch_count += 1
                command_count += len(batch)
                batch_times.append((time.time() - start) * 1000)
        
        # Flush remaining
        batch = batcher.flush_if_timeout()
        if batch:
            batch_count += 1
            command_count += len(batch)
        
        return {
            'total_commands': iterations,
            'batches_created': batch_count,
            'avg_batch_size': command_count / batch_count if batch_count > 0 else 0,
            'savings_percent': batcher.get_stats()['savings_percent']
        }
    
    def run_all_benchmarks(self) -> Dict:
        """Run all performance benchmarks"""
        print("=" * 80)
        print("PHASE 4.5 PERFORMANCE BENCHMARKS")
        print("=" * 80)
        
        results = {}
        
        # 1. Signal Command Comparison
        print("\n[BENCHMARK 1] Signal Commands (100 iterations)")
        baseline_sig = self.benchmark_signal_command_baseline(100)
        optimized_sig = self.benchmark_signal_command_optimized(100)
        
        print(f"  Baseline:")
        print(f"    Avg: {baseline_sig['avg']:.3f}ms")
        print(f"    Min: {baseline_sig['min']:.3f}ms")
        print(f"    Max: {baseline_sig['max']:.3f}ms")
        print(f"  Optimized (with caching + pooling):")
        print(f"    Avg: {optimized_sig['avg']:.3f}ms")
        print(f"    Min: {optimized_sig['min']:.3f}ms")
        print(f"    Max: {optimized_sig['max']:.3f}ms")
        
        improvement = ((baseline_sig['avg'] - optimized_sig['avg']) / baseline_sig['avg'] * 100)
        print(f"  Improvement: {improvement:.1f}% faster")
        results['signal_commands'] = {
            'baseline': baseline_sig,
            'optimized': optimized_sig,
            'improvement_percent': improvement
        }
        
        # 2. Train Query Comparison
        print("\n[BENCHMARK 2] Train Queries (100 iterations)")
        baseline_train = self.benchmark_train_query_baseline(100)
        optimized_train = self.benchmark_train_query_optimized(100)
        
        print(f"  Baseline (no cache):")
        print(f"    Avg: {baseline_train['avg']:.3f}ms")
        print(f"    Min: {baseline_train['min']:.3f}ms")
        print(f"    Max: {baseline_train['max']:.3f}ms")
        print(f"  Optimized (with cache):")
        print(f"    Avg: {optimized_train['avg']:.3f}ms")
        print(f"    Min: {optimized_train['min']:.3f}ms")
        print(f"    Max: {optimized_train['max']:.3f}ms")
        
        improvement = ((baseline_train['avg'] - optimized_train['avg']) / baseline_train['avg'] * 100)
        print(f"  Improvement: {improvement:.1f}% faster")
        results['train_queries'] = {
            'baseline': baseline_train,
            'optimized': optimized_train,
            'improvement_percent': improvement
        }
        
        # 3. Cache Performance
        print("\n[BENCHMARK 3] Cache Performance (1000 operations)")
        cache_perf = self.benchmark_cache_performance(1000)
        
        print(f"  Cache Hit:")
        print(f"    Count: {cache_perf['cache_hits']['count']}")
        print(f"    Avg: {cache_perf['cache_hits']['avg_micros']:.2f} us")
        print(f"  Cache Miss:")
        print(f"    Count: {cache_perf['cache_misses']['count']}")
        print(f"    Avg: {cache_perf['cache_misses']['avg_micros']:.2f} us")
        
        speedup = (cache_perf['cache_misses']['avg_micros'] / cache_perf['cache_hits']['avg_micros']) if cache_perf['cache_hits']['avg_micros'] > 0 else 1
        print(f"  Cache Hit {speedup:.1f}x faster than Miss")
        results['cache_performance'] = cache_perf
        
        # 4. Connection Pool
        print("\n[BENCHMARK 4] Connection Pool (100 operations)")
        pool_perf = self.benchmark_connection_pool(100)
        
        print(f"  Operations: {pool_perf['operations']}")
        print(f"  Avg latency: {pool_perf['avg_ms']:.3f}ms")
        print(f"  Pool utilization: {pool_perf['pool_stats']['utilization_percent']:.1f}%")
        print(f"  Peak usage: {pool_perf['pool_stats']['peak_usage']} connections")
        results['connection_pool'] = pool_perf
        
        # 5. Command Batching
        print("\n[BENCHMARK 5] Command Batching (100 commands)")
        batch_perf = self.benchmark_command_batching(100)
        
        print(f"  Total commands: {batch_perf['total_commands']}")
        print(f"  Batches created: {batch_perf['batches_created']}")
        print(f"  Avg batch size: {batch_perf['avg_batch_size']:.1f}")
        print(f"  Network savings: {batch_perf['savings_percent']:.1f}%")
        results['command_batching'] = batch_perf
        
        # Summary
        print("\n" + "=" * 80)
        print("PERFORMANCE IMPROVEMENT SUMMARY")
        print("=" * 80)
        
        print(f"\nSignal Commands: {results['signal_commands']['improvement_percent']:.1f}% faster")
        print(f"Train Queries: {results['train_queries']['improvement_percent']:.1f}% faster")
        print(f"Cache Speedup: {speedup:.1f}x")
        print(f"Network Savings: {batch_perf['savings_percent']:.1f}%")
        
        print("\n" + "=" * 80)
        print("[OK] BENCHMARKING COMPLETE")
        print("=" * 80)
        
        return results


def run_benchmarks():
    """Run all benchmarks"""
    benchmark = BenchmarkComparison()
    results = benchmark.run_all_benchmarks()
    
    # Verify key improvements
    # Train queries should show significant improvement with caching
    train_improvement = results['train_queries']['improvement_percent']
    print(f"\n[VALIDATION] Train query improvement: {train_improvement:.1f}%")
    assert train_improvement > 20, f"Train queries should improve >20% with cache, got {train_improvement:.1f}%"
    
    # Command batching should show network savings
    batch_savings = results['command_batching']['savings_percent']
    print(f"[VALIDATION] Command batching network savings: {batch_savings:.1f}%")
    assert batch_savings > 80, f"Batching should save >80% network, got {batch_savings:.1f}%"
    
    print("[OK] All performance validations passed")
    
    return True


if __name__ == "__main__":
    try:
        success = run_benchmarks()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"[ERROR] Benchmarking failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
