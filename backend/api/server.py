"""
DRISHTI FastAPI Server v5.0
Real-time Railway Accident Prevention — React SPA Backend Hub
"""

import json, asyncio, logging, random, uuid, os
from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path

from fastapi import FastAPI, WebSocket, Query, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DRISHTI API", description="Railway Accident Prevention System", version="5.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ── Global State ──────────────────────────────────────────────────────────────
active_connections: List[WebSocket] = []
alert_buffer: List[Dict] = []
stats = {
    "total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0,
    "trains_monitored": 2041, "batches_processed": 0,
    "uptime_start": datetime.now().isoformat()
}

# ── Indian Railways Data (With Coordinates) ───────────────────────────────────
TRAINS = [
    ("12001","Shatabdi Express"), ("12951","Mumbai Rajdhani"), ("12309","Patna Rajdhani"),
    ("12301","Howrah Rajdhani"), ("22691","Bangalore Rajdhani"), ("12622","Tamil Nadu Express"),
    ("12627","Karnataka Express"), ("12723","Telangana Express"), ("11061","Pawan Express"),
    ("12801","Purushottam SF"), ("12275","Duronto Express"), ("20503","NE Rajdhani"),
    ("12423","Dibrugarh Rajdhani"), ("12813","Steel Express"), ("12559","Shiv Ganga Express"),
    ("12381","Poorva Express"), ("14005","Lichchavi Express"), ("12002","Bhopal Shatabdi"),
]

STATIONS = [
    {"code":"NDLS","name":"New Delhi","lat":28.6430,"lng":77.2185},
    {"code":"MMCT","name":"Mumbai Central","lat":18.9696,"lng":72.8194},
    {"code":"HWH","name":"Howrah Jn","lat":22.5841,"lng":88.3435},
    {"code":"MAS","name":"Chennai Central","lat":13.0827,"lng":80.2707},
    {"code":"SBC","name":"Bengaluru City","lat":12.9784,"lng":77.5684},
    {"code":"PUNE","name":"Pune Jn","lat":18.5284,"lng":73.8743},
    {"code":"ADI","name":"Ahmedabad","lat":23.0256,"lng":72.5977},
    {"code":"JP","name":"Jaipur","lat":26.9196,"lng":75.7878},
    {"code":"LKO","name":"Lucknow NR","lat":26.8329,"lng":80.9205},
    {"code":"PNBE","name":"Patna Jn","lat":25.6022,"lng":85.1376},
    {"code":"BPL","name":"Bhopal Jn","lat":23.2647,"lng":77.4116},
    {"code":"NGP","name":"Nagpur","lat":21.1472,"lng":79.0881},
    {"code":"SC","name":"Secunderabad","lat":17.4337,"lng":78.5016},
    {"code":"ERS","name":"Ernakulam Jn","lat":9.9658,"lng":76.2929},
    {"code":"GHY","name":"Guwahati","lat":26.1820,"lng":91.7515},
]

RISK_FACTORS = [
    "Bayesian Network: P(accident)={r1:.3f} — Elevated junction collision probability",
    "Isolation Forest: anomaly_score={r2:.1f} — Unusual speed-delay pattern detected",
    "Causal DAG: causal_risk={r3:.3f} — Cascading delay chain at junction",
    "Consensus: Signal at red, train approaching at {r4:.0f} km/h in restricted block",
    "Speed anomaly: {r4:.0f} km/h in 60 km/h zone — emergency brake advisory",
    "Maintenance flag: Track inspection overdue, risk amplifier ×{r2:.1f}",
    "DBSCAN: Trajectory isolated from cluster — possible ghost train signature",
    "Weather correlation: Fog visibility <50m, stopping distance insufficient at {r4:.0f} km/h",
]

ZONES = ["NR","CR","WR","SR","ER","SER","NER","SCR","NFR","ECR"]
zone_counts: Dict[str, Dict] = {z: {"critical":0,"high":0,"medium":0,"low":0,"total":0} for z in ZONES}

def rand_vals():
    return dict(r1=random.uniform(0.6,0.99), r2=random.uniform(60,100),
                r3=random.uniform(0.55,0.95), r4=random.uniform(70,140))

def make_alert() -> Dict:
    train = random.choice(TRAINS)
    station = random.choice(STATIONS)
    severity = random.choices(
        ["CRITICAL","HIGH","MEDIUM","LOW"], weights=[5,15,40,40])[0]
    risk_score = {"CRITICAL": random.uniform(86,100), "HIGH": random.uniform(70,86),
                  "MEDIUM": random.uniform(50,70), "LOW": random.uniform(28,50)}[severity]
    methods = {"CRITICAL": random.randint(3,4), "HIGH": random.randint(2,3),
               "MEDIUM": 2, "LOW": random.randint(1,2)}[severity]
    explanation = random.choice(RISK_FACTORS).format(**rand_vals())
    zone = random.choice(ZONES)
    zone_counts[zone][severity.lower()] += 1
    zone_counts[zone]["total"] += 1
    
    # Randomize coordinates slightly around the station to show movement
    lat = station["lat"] + random.uniform(-0.02, 0.02)
    lng = station["lng"] + random.uniform(-0.02, 0.02)
    
    return {
        "id": f"ALT-{uuid.uuid4().hex[:6].upper()}",
        "train_id": train[0], "train_name": train[1],
        "station_code": station["code"], "station_name": station["name"],
        "lat": lat, "lng": lng,
        "severity": severity, "risk_score": round(risk_score, 1),
        "methods_agreeing": methods, "zone": zone,
        "bayesian_risk": round(random.uniform(0.5,0.99) if severity in ["CRITICAL","HIGH"] else random.uniform(0.2,0.6), 3),
        "anomaly_score": round(random.uniform(60,100), 1),
        "explanation": explanation,
        "actions": random.sample(["HUD_WARNING","BRAKE_ADVISORY","ALERT_ADJACENT","NOTIFY_CONTROLLER","LOG_AUDIT","REROUTE_SUGGESTION"], k=random.randint(2,4)),
        "timestamp": datetime.now().isoformat(),
    }

async def broadcast(msg: Dict):
    dead = []
    for ws in active_connections:
        try: await ws.send_json(msg)
        except: dead.append(ws)
    for ws in dead:
        try: active_connections.remove(ws)
        except: pass

async def streaming_loop():
    await asyncio.sleep(2)
    while True:
        try:
            n = random.choices([1,2,3], weights=[60,30,10])[0]
            for _ in range(n):
                alert = make_alert()
                stats["total"] += 1
                stats[alert["severity"].lower()] += 1
                stats["batches_processed"] += 1
                alert_buffer.append(alert)
                if len(alert_buffer) > 300: alert_buffer.pop(0)
                await broadcast({"type":"alert","data":alert,"stats":{**stats}})
                await asyncio.sleep(0.2)
            await asyncio.sleep(random.uniform(4,10))
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            await asyncio.sleep(5)

@app.on_event("startup")
async def startup():
    asyncio.create_task(streaming_loop())
    logger.info("[DRISHTI v5.0] Streaming engine started")

# ── API Routes ────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status":"online","service":"DRISHTI API v5.0",
            "timestamp":datetime.now().isoformat(),
            "connections":len(active_connections),"buffer":len(alert_buffer)}

@app.get("/api/stats")
async def get_stats():
    uptime = int((datetime.now() - datetime.fromisoformat(stats["uptime_start"])).total_seconds())
    return {**stats, "uptime_seconds":uptime,
            "active_connections":len(active_connections),"zones":zone_counts}

@app.get("/api/alerts/history")
async def history(severity: Optional[str]=Query(None), limit: int=Query(50,le=200), offset: int=Query(0)):
    items = list(reversed(alert_buffer))
    if severity: items = [a for a in items if a["severity"]==severity.upper()]
    return {"total":len(items),"alerts":items[offset:offset+limit]}

@app.get("/api/train/{train_id}/risk")
async def train_risk(train_id: str):
    alerts = [a for a in alert_buffer if a["train_id"]==train_id]
    if not alerts: return {"train_id":train_id,"risk_level":"UNKNOWN","alert_count":0}
    latest = alerts[-1]
    return {"train_id":train_id,"risk_level":latest["severity"],
            "risk_score":latest["risk_score"],"alert_count":len(alerts),"last_alert":latest}

@app.get("/api/models/explainability")
async def get_models_explainability():
    """Mock endpoint to provide data for the /models page visualization"""
    return {
        "bayesian": {
            "p_accident_given_signal_pass": 0.88,
            "p_accident_given_speeding": 0.72,
            "nodes": [
                {"id": "signal", "value": "RED"},
                {"id": "speed", "value": "110km/h"},
                {"id": "visibility", "value": "FOG (20m)"},
                {"id": "collision_risk", "value": "HIGH"}
            ]
        },
        "isolation_forest": {
            "threshold": 0.5,
            "anomalies_detected": 420,
            "normal_samples": 49000
        },
        "causal_dag": {
            "root_cause": "Delayed maintenance",
            "impact_chain": ["Signal Failure", "Driver Miscommunication", "Brake Over-reliance"]
        }
    }

@app.websocket("/ws/live")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        await websocket.send_json({
            "type":"init","stats":{**stats},
            "recent_alerts":list(reversed(alert_buffer[-30:])),"zones":zone_counts
        })
        while True:
            try: await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type":"heartbeat","ts":datetime.now().isoformat()})
    except:
        pass
    finally:
        try: active_connections.remove(websocket)
        except: pass

# ── Frontend Static Serving ───────────────────────────────────────────────────
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

# Check if dist exists, otherwise create a mock one so FastAPI doesn't crash before build
# (During deployment Render runs npm run build before uvicorn, so it's fine)
if not FRONTEND_DIR.exists():
    os.makedirs(FRONTEND_DIR, exist_ok=True)
    with open(FRONTEND_DIR / "index.html", "w") as f:
        f.write("<html><body>Building frontend...</body></html>")

app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets", html=True), name="assets")

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    """Fallback route to serve React's index.html for client-side routing"""
    file_path = FRONTEND_DIR / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(FRONTEND_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
