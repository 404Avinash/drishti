"""
Run DRISHTI Streaming Service
Start real-time pipeline with mock/Redis/Kafka backend
"""

import sys
import argparse
import logging
from backend.inference.streaming import StreamingPipeline
from backend.inference.config import StreamingConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description='DRISHTI Real-Time Streaming Service',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python run_streaming_service.py --backend mock --batch-size 100
  python run_streaming_service.py --backend redis --batch-size 50
  python run_streaming_service.py --backend kafka --workers 4
  python run_streaming_service.py --backend mock --single-batch
        '''
    )
    
    parser.add_argument(
        '--backend',
        choices=['kafka', 'redis', 'mock'],
        default='mock',
        help='Data source backend (default: mock)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Trains per batch (default: 100)'
    )
    
    parser.add_argument(
        '--workers',
        type=int,
        default=4,
        help='Parallel inference workers (default: 4)'
    )
    
    parser.add_argument(
        '--single-batch',
        action='store_true',
        help='Process single batch and exit (for testing)'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        default=60,
        help='Batch timeout in seconds (default: 60)'
    )
    
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Logging level (default: INFO)'
    )
    
    args = parser.parse_args()
    
    # Create config
    config = StreamingConfig(
        backend=args.backend,
        batch_size=args.batch_size,
        max_workers=args.workers,
        batch_timeout_sec=args.timeout,
        log_level=args.log_level
    )
    
    logger.info("=" * 70)
    logger.info("DRISHTI Real-Time Streaming Pipeline")
    logger.info("=" * 70)
    logger.info(f"Backend: {args.backend}")
    logger.info(f"Batch Size: {args.batch_size}")
    logger.info(f"Workers: {args.workers}")
    logger.info(f"Batch Timeout: {args.timeout}s")
    logger.info("=" * 70)
    
    try:
        # Create and run pipeline
        pipeline = StreamingPipeline(config)
        pipeline.connect()
        
        if args.single_batch:
            # Process single batch
            logger.info("[MODE] Single batch processing")
            result = pipeline.run_single_batch()
            
            if result:
                logger.info(f"Batch complete:")
                logger.info(f"  Trains: {result['trains']}")
                logger.info(f"  Alerts: {result['alerts']}")
                logger.info(f"  Latency: {result['latency_ms']}ms")
            else:
                logger.warning("No trains in batch")
        
        else:
            # Continuous processing
            logger.info("[MODE] Continuous streaming")
            logger.info("[INFO] Press Ctrl+C to stop...")
            pipeline.run_continuous()
    
    except KeyboardInterrupt:
        logger.info("[STOP] Keyboard interrupt received")
    
    except Exception as e:
        logger.error(f"[ERROR] {e}", exc_info=True)
        return 1
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
