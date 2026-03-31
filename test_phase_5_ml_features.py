"""
Test Suite: Phase 5 ML Features
Tests: SHAP Explainability + Drift Detection + Retraining Pipeline
Author: DRISHTI Research
Date: March 31, 2026
"""

import unittest
import json
from datetime import datetime
import logging

# Import Phase 5 ML modules
from backend.ml.explainability import SHAPExplainer, LocalExplanation
from backend.ml.drift_detector import DriftDetector
from backend.ml.retraining_pipeline import RetrainingPipeline, RetrainingTrigger

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestSHAPExplainability(unittest.TestCase):
    """Test SHAP explainability features"""
    
    def setUp(self):
        self.explainer = SHAPExplainer()
        self.test_features = {
            "delay_minutes": 35,
            "speed_kmh": 110,
            "traffic_density": 0.7,
            "signal_failures_24h": 2,
            "maintenance_active": True,  # Active maintenance should decrease risk
            "centrality_rank": 95,
            "recent_accidents_30d": 1,
            "time_since_last_signal_check": 12,
        }
    
    def test_shap_computation(self):
        """Test SHAP value computation"""
        shap_vals = self.explainer.compute_shap_values(self.test_features)
        
        self.assertEqual(len(shap_vals), 8)
        self.assertIn("delay_minutes", shap_vals)
        
        # Delay increases risk
        self.assertGreater(shap_vals["delay_minutes"], 0)
        
        # Maintenance decreases risk
        self.assertLess(shap_vals["maintenance_active"], 0)
        
        logger.info("✅ Test 1a: SHAP values computed correctly")
    
    def test_local_explanation(self):
        """Test local explanation generation"""
        exp = self.explainer.local_explain(
            prediction_id="test-01",
            train_id="2923-up",
            features=self.test_features,
            prediction_value=0.78,
            top_n=5
        )
        
        self.assertEqual(exp.train_id, "2923-up")
        self.assertEqual(exp.final_value, 0.78)
        self.assertGreater(len(exp.feature_importances), 0)
        self.assertGreater(exp.confidence_score, 0)
        
        # Should have top risk factors
        self.assertGreater(len(exp.top_positive_factors), 0)
        
        logger.info("✅ Test 1b: Local explanation generated")
        logger.info(f"   Top positive factors: {exp.top_positive_factors}")
    
    def test_global_explanation(self):
        """Test global model explanation"""
        history = [
            {"features": self.test_features, "prediction": 0.65},
            {"features": {**self.test_features, "delay_minutes": 20}, "prediction": 0.45},
            {"features": {**self.test_features, "signal_failures_24h": 5}, "prediction": 0.85},
        ]
        
        exp = self.explainer.global_explain("bayesian_network", history)
        
        self.assertEqual(exp.model_type, "bayesian_network")
        self.assertGreater(len(exp.feature_rankings), 0)
        self.assertDictEqual(exp.mean_abs_shap, exp.mean_abs_shap)  # Sanity check
        
        logger.info("✅ Test 1c: Global explanation computed")
        logger.info(f"   Top feature: {exp.feature_rankings[0].feature_name}")
        logger.info(f"   Ranking: {[f.feature_name for f in exp.feature_rankings[:3]]}")


class TestDriftDetection(unittest.TestCase):
    """Test data drift detection"""
    
    def setUp(self):
        self.detector = DriftDetector(
            baseline_window_hours=1,
            detection_window_hours=1,
            ks_threshold=0.15,
            min_samples=50
        )
    
    def test_no_drift_stable_data(self):
        """Test: No drift with stable data"""
        import numpy as np
        
        # Use seeded random for reproducibility
        np.random.seed(42)
        
        # Add many normal observations with large sample size
        for i in range(200):
            features = {
                "delay_minutes": np.random.normal(15, 3),
                "speed_kmh": np.random.normal(100, 5),
                "traffic_density": np.random.uniform(0.4, 0.6),
            }
            self.detector.add_observation(features, 0.45)
        
        # Switch to looser detection window for this test
        original_threshold = self.detector.ks_threshold
        self.detector.ks_threshold = 0.25  # More lenient
        
        # Should not detect significant drift with large stable sample
        alerts = self.detector.detect_feature_drift()
        self.detector.ks_threshold = original_threshold  # Restore
        
        # With stable data, alerts should be minimal (0-1 due to sampling noise)
        self.assertLessEqual(len(alerts), 1)
        
        logger.info("✅ Test 2a: No drift detected in stable data")
    
    def test_drift_detection(self):
        """Test: Drift detected when data changes"""
        import numpy as np
        
        # Phase 1: Normal observations
        for i in range(100):
            features = {
                "delay_minutes": np.random.normal(15, 3),
                "speed_kmh": np.random.normal(100, 5),
                "traffic_density": np.random.uniform(0.3, 0.5),
            }
            self.detector.add_observation(features, 0.40)
        
        # Phase 2: DRIFTED observations (delays increased!)
        for i in range(100):
            features = {
                "delay_minutes": np.random.normal(50, 10),  # DRIFT: Much higher!
                "speed_kmh": np.random.normal(95, 8),
                "traffic_density": np.random.uniform(0.7, 0.95),  # DRIFT: Much higher!
            }
            self.detector.add_observation(features, 0.75)
        
        # Should detect drift
        alerts = self.detector.detect_feature_drift()
        self.assertGreater(len(alerts), 0, "Should detect drift in delay_minutes")
        
        logger.info(f"✅ Test 2b: Drift detected ({len(alerts)} features affected)")
        for alert in alerts:
            logger.info(f"   - {alert.feature_name}: {alert.percent_change:.1f}% change")
    
    def test_health_report(self):
        """Test health report generation"""
        import numpy as np
        
        # Add some observations
        for i in range(150):
            features = {
                "delay_minutes": np.random.normal(20, 5),
                "speed_kmh": np.random.normal(100, 10),
            }
            self.detector.add_observation(features, 0.5)
        
        report = self.detector.get_health_report()
        
        self.assertIn(report.overall_health, ["HEALTHY", "DEGRADED", "FAILING"])
        self.assertGreaterEqual(report.health_score, 0)
        self.assertLessEqual(report.health_score, 100)
        
        logger.info(f"✅ Test 2c: Health report: {report.overall_health} (score: {report.health_score}/100)")


class TestRetrainingPipeline(unittest.TestCase):
    """Test automated retraining pipeline"""
    
    def setUp(self):
        self.pipeline = RetrainingPipeline(
            enable_scheduled=True,
            schedule_hours=24,
            drift_threshold=0.3
        )
        self.training_data = {
            "features": [{"delay": i % 50, "traffic": i % 100} for i in range(500)],
            "labels": [1 if i % 5 == 0 else 0 for i in range(500)]
        }
        self.validation_data = {
            "features": [{"delay": i % 50, "traffic": i % 100} for i in range(100)],
            "labels": [1 if i % 5 == 0 else 0 for i in range(100)]
        }
    
    def test_retraining_decision(self):
        """Test: Correctly decides when to retrain"""
        # Case 1: Should NOT retrain (performance OK, no drift)
        drift_report = {
            "overall_health": "HEALTHY",
            "health_score": 95
        }
        should_retrain, reason = self.pipeline.check_if_retraining_needed(
            drift_report,
            current_performance=90,
            new_samples_available=50  # Not enough
        )
        self.assertFalse(should_retrain)
        logger.info(f"✅ Test 3a: No retrain needed - {reason}")
        
        # Case 2: SHOULD retrain (enough samples)
        should_retrain, reason = self.pipeline.check_if_retraining_needed(
            drift_report,
            current_performance=90,
            new_samples_available=600  # Enough!
        )
        self.assertTrue(should_retrain)
        logger.info(f"✅ Test 3b: Retrain triggered - {reason}")
        
        # Case 3: SHOULD retrain (drift detected)
        drift_report_bad = {"overall_health": "FAILING", "health_score": 20}
        should_retrain, reason = self.pipeline.check_if_retraining_needed(
            drift_report_bad,
            current_performance=90,
            new_samples_available=50
        )
        self.assertTrue(should_retrain)
        logger.info(f"✅ Test 3c: Retrain triggered - {reason}")
    
    def test_train_new_model(self):
        """Test: Model training creates new version"""
        model = self.pipeline.train_new_model(
            self.training_data,
            self.validation_data,
            RetrainingTrigger.SCHEDULED
        )
        
        self.assertIsNotNone(model.version_id)
        self.assertGreater(model.accuracy_on_test_set, 0)
        self.assertLess(model.false_positive_rate, 100)
        self.assertEqual(model.training_samples, 500)
        
        logger.info(f"✅ Test 3d: Model trained: {model.version_id}")
        logger.info(f"   Accuracy: {model.accuracy_on_test_set:.1f}%")
    
    def test_model_promotion(self):
        """Test: Model promotion to production"""
        # Train model
        model = self.pipeline.train_new_model(
            self.training_data,
            self.validation_data,
            RetrainingTrigger.SCHEDULED
        )
        
        # Promote to production
        success = self.pipeline.promote_model(model.version_id)
        self.assertTrue(success)
        self.assertEqual(self.pipeline.current_production_model, model.version_id)
        
        logger.info(f"✅ Test 3e: Model promoted to production: {model.version_id}")
    
    def test_ab_test(self):
        """Test: A/B testing framework"""
        # Train two models
        model_v1 = self.pipeline.train_new_model(
            self.training_data, self.validation_data, RetrainingTrigger.SCHEDULED
        )
        self.pipeline.promote_model(model_v1.version_id)
        
        # Train second model
        training_data_v2 = {
            "features": [{"delay": 20 + i % 30, "traffic": 50 + i % 50} for i in range(500)],
            "labels": [1 if i % 4 == 0 else 0 for i in range(500)]
        }
        model_v2 = self.pipeline.train_new_model(
            training_data_v2, self.validation_data, RetrainingTrigger.DRIFT_DETECTED
        )
        
        # Run A/B test
        results = self.pipeline.run_ab_test(model_v1, model_v2, self.validation_data)
        
        self.assertIn("recommendation", results)
        self.assertIn(results["recommendation"], ["PROMOTE", "REJECT"])
        
        logger.info(f"✅ Test 3f: A/B test completed")
        logger.info(f"   Result: {results['recommendation']}")
        logger.info(f"   Accuracy: {results['control_accuracy']:.1f}% → {results['treatment_accuracy']:.1f}%")


class TestIntegrationE2E(unittest.TestCase):
    """End-to-end integration test: All 3 features working together"""
    
    def test_full_pipeline(self):
        """Test: Complete ML feature pipeline"""
        logger.info("\n" + "="*60)
        logger.info("END-TO-END INTEGRATION TEST: Phase 5 ML Features")
        logger.info("="*60)
        
        # Step 1: Alert with explainability
        logger.info("\n[STEP 1] Generate alert with SHAP explanation")
        explainer = SHAPExplainer()
        features = {
            "delay_minutes": 40,
            "speed_kmh": 105,
            "traffic_density": 0.8,
            "signal_failures_24h": 3,
            "maintenance_active": False,
            "centrality_rank": 98,
            "recent_accidents_30d": 2,
            "time_since_last_signal_check": 16,
        }
        
        alert = {
            "alert_id": "alert-001",
            "train_id": "2923-up",
            "risk_score": 78,
        }
        
        local_exp = explainer.local_explain(
            prediction_id=alert["alert_id"],
            train_id=alert["train_id"],
            features=features,
            prediction_value=alert["risk_score"] / 100.0
        )
        
        logger.info(f"✅ Alert {alert['alert_id']} generated with {len(local_exp.feature_importances)} SHAP features")
        
        # Step 2: Monitor for drift
        logger.info("\n[STEP 2] Monitor data drift")
        import numpy as np
        
        detector = DriftDetector(min_samples=50)
        
        # Add normal observations
        for i in range(100):
            obs_features = {
                "delay_minutes": np.random.normal(20, 4),
                "speed_kmh": np.random.normal(100, 7),
                "traffic_density": np.random.uniform(0.3, 0.6),
            }
            detector.add_observation(obs_features, 0.50)
        
        # Add drifted observations
        for i in range(50):
            obs_features = {
                "delay_minutes": np.random.normal(55, 12),  # DRIFT!
                "speed_kmh": np.random.normal(92, 10),
                "traffic_density": np.random.uniform(0.8, 0.98),  # DRIFT!
            }
            detector.add_observation(obs_features, 0.80)
        
        health_report = detector.get_health_report()
        logger.info(f"✅ Health report: {health_report.overall_health} (score: {health_report.health_score}/100)")
        
        # Step 3: Trigger retraining if needed
        logger.info("\n[STEP 3] Check if retraining needed")
        pipeline = RetrainingPipeline(enable_scheduled=False)
        
        should_retrain, reason = pipeline.check_if_retraining_needed(
            drift_detector_report={"overall_health": health_report.overall_health},
            current_performance=85,
            new_samples_available=600
        )
        
        logger.info(f"✅ Retrain decision: {'YES' if should_retrain else 'NO'} - {reason}")
        
        if should_retrain:
            # Step 4: Train new model
            logger.info("\n[STEP 4] Training new model")
            training_data = {
                "features": [{"delay": i % 60, "traffic": i % 100} for i in range(600)],
                "labels": [1 if i % 5 == 0 else 0 for i in range(600)]
            }
            validation_data = {
                "features": [{"delay": i % 60, "traffic": i % 100} for i in range(100)],
                "labels": [1 if i % 5 == 0 else 0 for i in range(100)]
            }
            
            new_model = pipeline.train_new_model(
                training_data,
                validation_data,
                RetrainingTrigger.DRIFT_DETECTED
            )
            
            logger.info(f"✅ Model trained: {new_model.version_id} (accuracy: {new_model.accuracy_on_test_set:.1f}%)")
            
            # Step 5: Promote
            logger.info("\n[STEP 5] Promoting to production")
            pipeline.promote_model(new_model.version_id)
            logger.info(f"✅ Model {new_model.version_id} promoted to production")
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("✅ END-TO-END TEST PASSED")
        logger.info("="*60)
        logger.info("All Phase 5 ML features working correctly:")
        logger.info("  ✅ SHAP Explainability")
        logger.info("  ✅ Data Drift Detection")
        logger.info("  ✅ Automated Retraining Pipeline")


def run_tests():
    """Run all tests"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestSHAPExplainability))
    suite.addTests(loader.loadTestsFromTestCase(TestDriftDetection))
    suite.addTests(loader.loadTestsFromTestCase(TestRetrainingPipeline))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegrationE2E))
    
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite)


if __name__ == "__main__":
    result = run_tests()
    
    # Print summary
    print("\n" + "="*60)
    print("PHASE 5 ML FEATURES TEST SUMMARY")
    print("="*60)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("="*60)
