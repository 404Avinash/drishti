"""
DRISHTI Phase 4.5: Load Testing Suite
Test system performance with 100+ concurrent drivers and operations
"""

import sys
import time
from datetime import datetime
from typing import List, Dict, Tuple
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import statistics

from backend.driver.mobile_app import DriverMobileAppBackend, MobileDriver
from backend.scada.connector import SCDAConnector, SCDAVendor, SCDACommand, SCDACommandType
from backend.performance.optimizer import OptimizedSCADAConnector, NTESCacheLayer


@dataclass
class LoadTestConfig:
    """Load test configuration"""
    num_drivers: int = 100
    num_trains: int = 50
    num_signals: int = 100
    alerts_per_driver: int = 10
    concurrent_connections: int = 20
    test_duration_seconds: int = 30
    cache_enabled: bool = True


class PerformanceBenchmark:
    """Benchmark and measure performance metrics"""
    
    def __init__(self):
        self.operation_times = {}  # operation_name -> list of times
        self.errors = []
        self.start_time = None
        self.end_time = None
    
    def start_timing(self, operation: str):
        """Start timing an operation"""
        if operation not in self.operation_times:
            self.operation_times[operation] = []
        self._operation_start = (operation, time.time())
    
    def end_timing(self):
        """End timing and record"""
        if hasattr(self, '_operation_start'):
            op_name, start_t = self._operation_start
            elapsed = (time.time() - start_t) * 1000  # Convert to ms
            self.operation_times[op_name].append(elapsed)
    
    def record_error(self, error: str):
        """Record error"""
        self.errors.append(error)
    
    def get_summary(self) -> Dict:
        """Get performance summary"""
        summary = {}
        
        for op, times in self.operation_times.items():
            if times:
                summary[op] = {
                    'count': len(times),
                    'min_ms': min(times),
                    'max_ms': max(times),
                    'avg_ms': statistics.mean(times),
                    'median_ms': statistics.median(times),
                    'p95_ms': sorted(times)[int(len(times)*0.95)] if len(times) > 0 else 0,
                    'p99_ms': sorted(times)[int(len(times)*0.99)] if len(times) > 0 else 0
                }
        
        return {
            'operations': summary,
            'total_errors': len(self.errors),
            'error_rate_percent': (len(self.errors) / sum(len(v) for v in self.operation_times.values()) * 100) if self.operation_times else 0
        }


class ConcurrentLoadTester:
    """Test system with concurrent load"""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.benchmark = PerformanceBenchmark()
        self.mobile_backend = DriverMobileAppBackend()
        self.scada_connector = SCDAConnector(SCDAVendor.NATIVE_IR)
        self.optimized_scada = OptimizedSCADAConnector()
        self.ntes_cache = NTESCacheLayer()
        
        # Authenticate SCADA
        self.scada_connector.authenticate("admin", "password", "https://scada.ir.gov.in")
    
    def setup_infrastructure(self):
        """Setup test infrastructure"""
        print("[SETUP] Creating test infrastructure...")
        
        # Register drivers
        for i in range(self.config.num_drivers):
            driver = MobileDriver(
                driver_id=f"DRV_{i:04d}",
                name=f"Driver {i}",
                emp_code=f"EMP_{i:06d}",
                phone=f"+91-{9000000000 + i}",
                email=f"driver{i}@ir.gov.in",
                train_id=f"TRAIN_{i % self.config.num_trains:04d}",
                device_type="android" if i % 2 == 0 else "ios"
            )
            self.mobile_backend.register_driver(driver)
        
        # Register signals with SCADA
        for i in range(self.config.num_signals):
            station_code = f"STN_{i % 10:02d}"
            signal_id = f"SIGNAL_{i:04d}"
            self.scada_connector.register_signal(signal_id, station_code, "home")
        
        # Register trains with SCADA
        for i in range(self.config.num_trains):
            self.scada_connector.register_train(
                f"TRAIN_{i:04d}",
                initial_location=100.0 + (i * 10),
                speed=80 + (i % 20)
            )
        
        print(f"[OK] Setup complete: {self.config.num_drivers} drivers, {self.config.num_signals} signals, {self.config.num_trains} trains")
    
    def test_driver_alert_creation(self) -> None:
        """Test concurrent driver alert creation"""
        print("\n[TEST] Driver Alert Creation (Concurrent)")
        
        def create_alert(driver_idx: int, alert_idx: int):
            try:
                self.benchmark.start_timing("driver_alert_creation")
                
                driver_id = f"DRV_{driver_idx:04d}"
                train_id = f"TRAIN_{driver_idx % self.config.num_trains:04d}"
                
                alert = {
                    'alert_id': f"ALERT_{driver_idx}_{alert_idx}",
                    'severity': ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'][alert_idx % 4],
                    'reason': f'Test alert {alert_idx}',
                    'location_km': 100 + (driver_idx % 100),
                    'current_speed': 80
                }
                
                self.mobile_backend.create_driver_alert(alert, train_id, driver_id)
                self.benchmark.end_timing()
                
            except Exception as e:
                self.benchmark.record_error(str(e))
        
        with ThreadPoolExecutor(max_workers=self.config.concurrent_connections) as executor:
            futures = []
            for d in range(min(50, self.config.num_drivers)):
                for a in range(self.config.alerts_per_driver // 10):
                    futures.append(executor.submit(create_alert, d, a))
            
            for future in as_completed(futures):
                future.result()
        
        stats = self.benchmark.get_summary()
        if 'driver_alert_creation' in stats['operations']:
            s = stats['operations']['driver_alert_creation']
            print(f"[OK] Alerts created: {s['count']}")
            print(f"[OK] Avg latency: {s['avg_ms']:.2f}ms")
            print(f"[OK] P95 latency: {s['p95_ms']:.2f}ms")
    
    def test_scada_signal_commands(self) -> None:
        """Test concurrent SCADA signal commands"""
        print("\n[TEST] SCADA Signal Commands (Concurrent)")
        
        def set_signal(signal_idx: int, state_idx: int):
            try:
                self.benchmark.start_timing("scada_signal_command")
                
                signal_id = f"SIGNAL_{signal_idx:04d}"
                state = ['RED', 'YELLOW', 'GREEN'][state_idx % 3]
                
                cmd = SCDACommand(
                    command_id=f"CMD_SIG_{signal_idx}_{state_idx}",
                    command_type=SCDACommandType.SET_SIGNAL,
                    target_system="SCADA",
                    payload={'signal_id': signal_id, 'state': state},
                    priority=2
                )
                
                self.scada_connector.send_command(cmd)
                self.benchmark.end_timing()
                
            except Exception as e:
                self.benchmark.record_error(str(e))
        
        with ThreadPoolExecutor(max_workers=self.config.concurrent_connections) as executor:
            futures = []
            for s in range(min(50, self.config.num_signals)):
                for st in range(5):
                    futures.append(executor.submit(set_signal, s, st))
            
            for future in as_completed(futures):
                future.result()
        
        stats = self.benchmark.get_summary()
        if 'scada_signal_command' in stats['operations']:
            s = stats['operations']['scada_signal_command']
            print(f"[OK] Commands sent: {s['count']}")
            print(f"[OK] Avg latency: {s['avg_ms']:.2f}ms")
            print(f"[OK] P95 latency: {s['p95_ms']:.2f}ms")
    
    def test_train_queries(self, use_cache: bool = False) -> None:
        """Test concurrent train location queries"""
        print(f"\n[TEST] Train Location Queries {'(With Cache)' if use_cache else '(No Cache)'}")
        
        def query_train(train_idx: int):
            try:
                self.benchmark.start_timing("train_location_query")
                
                train_id = f"TRAIN_{train_idx:04d}"
                
                if use_cache:
                    # First populate cache
                    self.ntes_cache.cache_train_location(train_id, {
                        'train_id': train_id,
                        'location_km': 100 + train_idx,
                        'speed_kmph': 80
                    })
                    # Then query (should be cached)
                    self.ntes_cache.get_train_location(train_id)
                else:
                    cmd = SCDACommand(
                        command_id=f"QUERY_{train_idx}",
                        command_type=SCDACommandType.QUERY_TRAIN_LOCATION,
                        target_system="NTES",
                        payload={'train_id': train_id},
                        priority=2
                    )
                    self.scada_connector.send_command(cmd)
                
                self.benchmark.end_timing()
                
            except Exception as e:
                self.benchmark.record_error(str(e))
        
        with ThreadPoolExecutor(max_workers=self.config.concurrent_connections) as executor:
            futures = []
            for t in range(min(100, self.config.num_trains * 2)):
                futures.append(executor.submit(query_train, t))
            
            for future in as_completed(futures):
                future.result()
        
        stats = self.benchmark.get_summary()
        if 'train_location_query' in stats['operations']:
            s = stats['operations']['train_location_query']
            print(f"[OK] Queries executed: {s['count']}")
            print(f"[OK] Avg latency: {s['avg_ms']:.2f}ms")
            print(f"[OK] P95 latency: {s['p95_ms']:.2f}ms")
            print(f"[OK] P99 latency: {s['p99_ms']:.2f}ms")
    
    def test_optimized_operations(self) -> None:
        """Test optimized SCADA operations with caching and pooling"""
        print("\n[TEST] Optimized SCADA Operations (with Caching & Pooling)")
        
        def optimized_signal(signal_idx: int):
            try:
                self.benchmark.start_timing("optimized_signal_command")
                
                signal_id = f"SIGNAL_{signal_idx % 50:04d}"
                self.optimized_scada.execute_signal_command_optimized(signal_id, 'RED')
                
                self.benchmark.end_timing()
                
            except Exception as e:
                self.benchmark.record_error(str(e))
        
        def optimized_query(train_idx: int):
            try:
                self.benchmark.start_timing("optimized_train_query")
                
                train_id = f"TRAIN_{train_idx % 30:04d}"
                self.optimized_scada.execute_train_query_optimized(train_id)
                
                self.benchmark.end_timing()
                
            except Exception as e:
                self.benchmark.record_error(str(e))
        
        with ThreadPoolExecutor(max_workers=self.config.concurrent_connections) as executor:
            futures = []
            
            # Mix of signal commands and train queries
            for i in range(100):
                if i % 2 == 0:
                    futures.append(executor.submit(optimized_signal, i))
                else:
                    futures.append(executor.submit(optimized_query, i))
            
            for future in as_completed(futures):
                future.result()
        
        stats = self.benchmark.get_summary()
        print(f"[OK] Optimized operations completed")
        
        if 'optimized_signal_command' in stats['operations']:
            s = stats['operations']['optimized_signal_command']
            print(f"    Signal commands: {s['count']}, avg latency: {s['avg_ms']:.2f}ms")
        
        if 'optimized_train_query' in stats['operations']:
            s = stats['operations']['optimized_train_query']
            print(f"    Train queries: {s['count']}, avg latency: {s['avg_ms']:.2f}ms")
        
        # Show optimization stats
        opt_stats = self.optimized_scada.get_performance_stats()
        print(f"\n[OK] Optimization stats:")
        print(f"    Cache hits: {opt_stats['optimization_stats']['cache_hits']}")
        print(f"    Cache miss rate: {100 - opt_stats['cache_stats']['hit_rate_percent']:.1f}%")
        print(f"    Connection pool utilization: {opt_stats['pool_stats']['utilization_percent']:.1f}%")
    
    def test_stress_scenario(self) -> None:
        """Stress test with realistic mixed workload"""
        print("\n[TEST] Stress Test - Mixed Realistic Workload")
        
        workload_count = {
            'alerts': 0,
            'signals': 0,
            'queries': 0
        }
        
        def mixed_workload(operation_idx: int):
            try:
                op_type = operation_idx % 3
                
                if op_type == 0:  # Alert
                    self.benchmark.start_timing("stress_alert")
                    driver_id = f"DRV_{operation_idx % 50:04d}"
                    train_id = f"TRAIN_{operation_idx % 30:04d}"
                    alert = {
                        'alert_id': f"STRESS_{operation_idx}",
                        'severity': ['CRITICAL', 'HIGH', 'MEDIUM'][operation_idx % 3],
                        'reason': 'Stress test',
                        'location_km': 100 + operation_idx,
                        'current_speed': 80
                    }
                    self.mobile_backend.create_driver_alert(alert, train_id, driver_id)
                    self.benchmark.end_timing()
                    workload_count['alerts'] += 1
                
                elif op_type == 1:  # Signal command
                    self.benchmark.start_timing("stress_signal")
                    self.optimized_scada.execute_signal_command_optimized(
                        f"SIGNAL_{operation_idx % 50:04d}",
                        ['RED', 'YELLOW', 'GREEN'][operation_idx % 3]
                    )
                    self.benchmark.end_timing()
                    workload_count['signals'] += 1
                
                else:  # Query
                    self.benchmark.start_timing("stress_query")
                    self.optimized_scada.execute_train_query_optimized(
                        f"TRAIN_{operation_idx % 50:04d}"
                    )
                    self.benchmark.end_timing()
                    workload_count['queries'] += 1
                
            except Exception as e:
                self.benchmark.record_error(str(e))
        
        with ThreadPoolExecutor(max_workers=self.config.concurrent_connections) as executor:
            futures = []
            for i in range(300):  # 300 mixed operations
                futures.append(executor.submit(mixed_workload, i))
            
            for future in as_completed(futures):
                future.result()
        
        stats = self.benchmark.get_summary()
        print(f"[OK] Stress test workload executed:")
        print(f"    Alerts: {workload_count['alerts']}")
        print(f"    Signals: {workload_count['signals']}")
        print(f"    Queries: {workload_count['queries']}")
        print(f"    Total errors: {stats['total_errors']}")
        
        for op_type in ['stress_alert', 'stress_signal', 'stress_query']:
            if op_type in stats['operations']:
                s = stats['operations'][op_type]
                print(f"    {op_type}: avg {s['avg_ms']:.2f}ms, p95 {s['p95_ms']:.2f}ms, p99 {s['p99_ms']:.2f}ms")
    
    def run_all_tests(self) -> Dict:
        """Run all load tests"""
        print("=" * 80)
        print("PHASE 4.5 LOAD TESTING - PERFORMANCE OPTIMIZATION")
        print("=" * 80)
        
        self.setup_infrastructure()
        
        print("\n" + "=" * 80)
        print("RUNNING LOAD TESTS")
        print("=" * 80)
        
        self.test_driver_alert_creation()
        self.test_scada_signal_commands()
        self.test_train_queries(use_cache=False)
        self.test_train_queries(use_cache=True)
        self.test_optimized_operations()
        self.test_stress_scenario()
        
        # Final summary
        print("\n" + "=" * 80)
        print("PERFORMANCE SUMMARY")
        print("=" * 80)
        
        summary = self.benchmark.get_summary()
        
        for operation, stats in summary['operations'].items():
            print(f"\n{operation}:")
            print(f"    Operations: {stats['count']}")
            print(f"    Min: {stats['min_ms']:.2f}ms")
            print(f"    Max: {stats['max_ms']:.2f}ms")
            print(f"    Avg: {stats['avg_ms']:.2f}ms")
            print(f"    Median: {stats['median_ms']:.2f}ms")
            print(f"    P95: {stats['p95_ms']:.2f}ms")
            print(f"    P99: {stats['p99_ms']:.2f}ms")
        
        print(f"\nTotal Errors: {summary['total_errors']}")
        print(f"Error Rate: {summary['error_rate_percent']:.2f}%")
        
        print("\n" + "=" * 80)
        print("[OK] PHASE 4.5 LOAD TESTING COMPLETE")
        print("=" * 80)
        
        return summary


def run_load_tests():
    """Run load testing suite"""
    config = LoadTestConfig(
        num_drivers=100,
        num_trains=50,
        num_signals=100,
        alerts_per_driver=10,
        concurrent_connections=20,
        cache_enabled=True
    )
    
    tester = ConcurrentLoadTester(config)
    summary = tester.run_all_tests()
    
    return summary['total_errors'] == 0


if __name__ == "__main__":
    from dataclasses import dataclass
    
    # Import LoadTestConfig if not already imported
    try:
        success = run_load_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"[ERROR] Load testing failed: {str(e)}")
        sys.exit(1)
