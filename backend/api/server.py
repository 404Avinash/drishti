"""
DRISHTI FastAPI Server
REST endpoints + WebSocket for real-time dashboard
"""

import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from pathlib import Path

from fastapi import FastAPI, WebSocket, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.alerts.engine import AuditLog, DrishtiAlert
from backend.inference.streaming import StreamingPipeline
from backend.inference.config import StreamingConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="DRISHTI API",
    description="Railway accident prediction and alert system",
    version="3.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
audit_log = AuditLog(log_file='drishti_alerts.jsonl')
streaming_pipeline: Optional[StreamingPipeline] = None
active_connections: List[WebSocket] = []
results_queue_file = 'streaming_results.jsonl'


@app.on_event("startup")
async def startup_event():
    """Initialize streaming pipeline on startup"""
    global streaming_pipeline
    try:
        config = StreamingConfig(backend='mock', batch_size=100)
        streaming_pipeline = StreamingPipeline(config)
        streaming_pipeline.connect()
        logger.info("[API] Streaming pipeline initialized")
    except Exception as e:
        logger.error(f"[API] Failed to initialize streaming: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if streaming_pipeline:
        streaming_pipeline.stop()
    logger.info("[API] Server shutdown")


# ============================================================================
# ROOT ENDPOINTS
# ============================================================================

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve dashboard UI"""
    dashboard_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>DRISHTI Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu; background: #0f172a; color: #e2e8f0; }
            .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
            header { border-bottom: 2px solid #1e293b; padding: 20px 0; margin-bottom: 30px; }
            h1 { font-size: 2.5em; color: #60a5fa; }
            .status { font-size: 0.9em; color: #94a3b8; margin-top: 5px; }
            
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
            
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; }
            .card h3 { color: #60a5fa; margin-bottom: 15px; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
            .card-value { font-size: 2.5em; font-weight: bold; }
            .card-label { font-size: 0.9em; color: #94a3b8; margin-top: 8px; }
            
            .alert-critical { color: #ef4444; }
            .alert-high { color: #f97316; }
            .alert-medium { color: #eab308; }
            .alert-low { color: #10b981; }
            
            .alerts-list { background: #1e293b; border-radius: 8px; border: 1px solid #334155; }
            .alert-item { border-bottom: 1px solid #334155; padding: 15px; }
            .alert-item:last-child { border-bottom: none; }
            
            .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 0.85em; font-weight: bold; }
            .badge-critical { background: #7f1d1d; color: #fecaca; }
            .badge-high { background: #92400e; color: #fed7aa; }
            .badge-medium { background: #713f12; color: #fde047; }
            .badge-low { background: #064e3b; color: #86efac; }
            
            .command-line { background: #0f172a; border: 1px solid #334155; border-radius: 4px; padding: 10px; font-family: 'Courier New'; font-size: 0.85em; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>🚆 DRISHTI Dashboard</h1>
                <div class="status">Real-time railway accident prediction system</div>
            </header>
            
            <div class="grid">
                <div class="card">
                    <h3>Total Alerts</h3>
                    <div class="card-value" id="totalAlerts">0</div>
                    <div class="card-label">All severity levels</div>
                </div>
                <div class="card">
                    <h3>Critical Alerts</h3>
                    <div class="card-value alert-critical" id="criticalAlerts">0</div>
                    <div class="card-label">High priority</div>
                </div>
                <div class="card">
                    <h3>Trains Processed</h3>
                    <div class="card-value" id="trainsProcessed">0</div>
                    <div class="card-label">Current session</div>
                </div>
                <div class="card">
                    <h3>System Status</h3>
                    <div class="card-value" id="systemStatus" style="color: #10b981;">🟢 ONLINE</div>
                    <div class="card-label">Streaming active</div>
                </div>
            </div>
            
            <h2 style="margin-bottom: 20px; font-size: 1.3em;">Live Alerts Feed</h2>
            <div class="alerts-list">
                <div id="alertsList" style="max-height: 400px; overflow-y: auto;">
                    <div style="padding: 40px 20px; text-align: center; color: #64748b;">
                        Waiting for live alerts...
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 20px;">
                <h3>API Endpoints</h3>
                <div class="command-line">
                    GET  /api/train/&lt;train_id&gt;/risk<br>
                    GET  /api/alerts/history<br>
                    POST /api/alert/acknowledge<br>
                    WS   /ws/live
                </div>
            </div>
        </div>
        
        <script>
            let stats = { total: 0, critical: 0, trains: 0 };
            
            // Fetch initial stats
            async function updateStats() {
                try {
                    const res = await fetch('/api/stats');
                    const data = await res.json();
                    stats = data;
                    document.getElementById('totalAlerts').textContent = data.total;
                    document.getElementById('criticalAlerts').textContent = data.critical;
                    document.getElementById('trainsProcessed').textContent = data.trains;
                } catch (e) {
                    console.error('Stats fetch failed:', e);
                }
            }
            
            // WebSocket for live alerts
            function connectWebSocket() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const ws = new WebSocket(protocol + '//' + window.location.host + '/ws/live');
                
                ws.onmessage = (event) => {
                    const alert = JSON.parse(event.data);
                    addAlertToList(alert);
                    updateStats();
                };
                
                ws.onerror = () => {
                    document.getElementById('systemStatus').style.color = '#ef4444';
                    document.getElementById('systemStatus').textContent = '🔴 OFFLINE';
                };
                
                ws.onclose = () => {
                    setTimeout(connectWebSocket, 3000);
                };
            }
            
            function addAlertToList(alert) {
                const list = document.getElementById('alertsList');
                if (list.children[0]?.textContent.includes('Waiting')) {
                    list.innerHTML = '';
                }
                
                const item = document.createElement('div');
                item.className = 'alert-item';
                const severityClass = 'badge-' + alert.severity.toLowerCase();
                const timeStr = new Date(alert.timestamp).toLocaleTimeString();
                
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 5px;">${alert.train_id}</div>
                            <div style="font-size: 0.85em; color: #94a3b8;">${alert.explanation}</div>
                        </div>
                        <div>
                            <span class="severity-badge ${severityClass}">${alert.severity}</span>
                            <div style="font-size: 0.8em; color: #64748b; margin-top: 5px;">${timeStr}</div>
                        </div>
                    </div>
                `;
                list.insertBefore(item, list.firstChild);
                if (list.children.length > 10) list.removeChild(list.lastChild);
            }
            
            updateStats();
            connectWebSocket();
            setInterval(updateStats, 5000);
        </script>
    </body>
    </html>
    """
    return dashboard_html


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "service": "DRISHTI API v3.0"
    }


# ============================================================================
# TRAIN RISK ENDPOINTS
# ============================================================================

@app.get("/api/train/{train_id}/risk")
async def get_train_risk(train_id: str):
    """Get current risk assessment for a train"""
    try:
        # Find recent alerts for this train
        alerts = audit_log.query_alerts(train_id=train_id)
        
        if not alerts:
            return {
                "train_id": train_id,
                "risk_level": "LOW",
                "alert_count": 0,
                "last_alert": None
            }
        
        # Get latest alert
        latest = alerts[-1]
        return {
            "train_id": train_id,
            "risk_level": latest.severity,
            "risk_score": latest.risk_score,
            "methods_agreeing": latest.methods_agreeing,
            "alert_count": len(alerts),
            "last_alert": {
                "id": str(latest.alert_id),
                "timestamp": latest.timestamp.isoformat(),
                "severity": latest.severity,
                "explanation": latest.explanation.primary_factor,
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ALERT ENDPOINTS
# ============================================================================

@app.get("/api/alerts/history")
async def get_alert_history(
    severity: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0),
):
    """Get alert history with optional filtering"""
    try:
        # Get all alerts (simplified)
        all_alerts = audit_log.query_alerts()
        
        # Filter by severity if specified
        if severity:
            all_alerts = [a for a in all_alerts if a.severity == severity.upper()]
        
        # Apply pagination
        total = len(all_alerts)
        alerts = all_alerts[offset:offset+limit]
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "alerts": [
                {
                    "id": str(a.alert_id),
                    "train_id": a.train_id,
                    "severity": a.severity,
                    "risk_score": a.risk_score,
                    "timestamp": a.timestamp.isoformat(),
                    "explanation": a.explanation.primary_factor,
                    "methods_agreeing": a.methods_agreeing,
                }
                for a in alerts
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/alert/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, driver_id: str = Query(...)):
    """Record driver acknowledgment of alert"""
    try:
        # Find and acknowledge alert
        for alert in audit_log.alerts:
            if str(alert.alert_id) == alert_id:
                audit_log.record_acknowledgment(alert_id, driver_id)
                return {
                    "status": "acknowledged",
                    "alert_id": alert_id,
                    "driver_id": driver_id,
                    "timestamp": datetime.now().isoformat()
                }
        
        raise HTTPException(status_code=404, detail="Alert not found")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STATISTICS & MONITORING
# ============================================================================

@app.get("/api/stats")
async def get_statistics():
    """Get system statistics"""
    try:
        stats = audit_log.get_statistics()
        
        # Add streaming metrics if available
        streaming_stats = {}
        if streaming_pipeline:
            streaming_stats = streaming_pipeline.get_metrics()
        
        return {
            "total": stats['total_alerts'],
            "critical": stats['critical_alerts'],
            "high": stats['high_alerts'],
            "medium": stats['medium_alerts'],
            "low": stats['low_alerts'],
            "acknowledged": stats['acknowledged_alerts'],
            "trains": streaming_stats.get('total_trains', 0),
            "batches": streaming_stats.get('total_batches', 0),
            "avg_latency_ms": streaming_stats.get('avg_batch_latency_ms', 0),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics")
async def get_metrics():
    """Get detailed pipeline metrics"""
    try:
        if streaming_pipeline:
            return streaming_pipeline.get_metrics()
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# WEBSOCKET FOR LIVE UPDATES
# ============================================================================

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time dashboard updates"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        # Send initial stats
        stats = audit_log.get_statistics()
        await websocket.send_json({
            "type": "stats_update",
            "data": stats
        })
        
        # Monitor for new alerts
        last_check = datetime.now()
        
        while True:
            # Check for new alerts every 2 seconds
            alerts = audit_log.query_alerts()
            new_alerts = [a for a in alerts if a.timestamp > last_check]
            
            for alert in new_alerts:
                await websocket.send_json({
                    "type": "alert",
                    "train_id": alert.train_id,
                    "timestamp": alert.timestamp.isoformat(),
                    "severity": alert.severity,
                    "explanation": alert.explanation.primary_factor,
                    "risk_score": alert.risk_score,
                })
            
            last_check = datetime.now()
            await asyncio.sleep(2)
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    
    finally:
        active_connections.remove(websocket)


# ============================================================================
# JUNCTION & ROUTE ENDPOINTS
# ============================================================================

@app.get("/api/junction/{junction_id}/status")
async def get_junction_status(junction_id: str):
    """Get safety status for a junction"""
    try:
        # This would query multiple trains approaching the junction
        # For now, return mock data
        return {
            "junction_id": junction_id,
            "status": "safe",
            "trains_monitored": 12,
            "current_alerts": 0,
            "recent_incidents": 0,
            "last_update": datetime.now().isoformat(),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STREAMING CONTROL
# ============================================================================

@app.post("/api/streaming/start")
async def start_streaming(background_tasks: BackgroundTasks):
    """Start streaming pipeline"""
    try:
        if streaming_pipeline and not streaming_pipeline._running:
            background_tasks.add_task(streaming_pipeline.run_continuous)
            return {"status": "started"}
        return {"status": "already_running"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/streaming/stop")
async def stop_streaming():
    """Stop streaming pipeline"""
    try:
        if streaming_pipeline:
            streaming_pipeline.stop()
            return {"status": "stopped"}
        return {"status": "not_running"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/streaming/process-batch")
async def process_batch():
    """Process a single batch (manual trigger)"""
    try:
        if streaming_pipeline:
            result = streaming_pipeline.run_single_batch()
            return result or {"trains": 0, "alerts": 0, "latency_ms": 0}
        raise HTTPException(status_code=400, detail="Streaming not initialized")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Run server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
