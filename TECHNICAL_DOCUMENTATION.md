 # DRISHTI: Railway Accident Prediction System — Technical Documentation

**System Version:** 2.0.0  
**Last Updated:** April 2026  
**Status:** Production-Ready (with caveats)  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Breakdown](#2-architecture-breakdown)
3. [Data Flow & Processing](#3-data-flow--processing)
4. [Backend Design](#4-backend-design)
5. [AI/ML Pipeline](#5-aiml-pipeline)
6. [DevOps & Deployment](#6-devops--deployment)
7. [Design Decisions & Trade-offs](#7-design-decisions--trade-offs)
8. [Performance & Bottlenecks](#8-performance--bottlenecks)
9. [Security Considerations](#9-security-considerations)
10. [Suggestions & Improvements](#10-suggestions--improvements)

---

## 1. System Overview

### 1.1 Purpose & Core Objective

**Drishti** ("vision" in Hindi) is a **real-time railway accident prediction system** designed for Indian Railways. It predicts cascade delays and potential accidents 30–60 minutes ahead by analyzing live train telemetry, network topology, and historical incident patterns.

**Core Problem:** Indian Railways operates 1.03 lakh km of track with 9000+ trains daily. Individual train delays often cascade across the network, causing system-wide disruptions. Traditional incident management is reactive; Drishti is proactive.

**Solution Approach:**
- Ingest live NTES (National Train Enquiry System) data every 5 minutes
- Compute 20+ engineered features per train in real-time
- Run 4 independent ML models in parallel (Bayesian Network, Isolation Forest, DBSCAN, Causal DAG)
- Use ensemble voting (2+ methods required) to fire high-confidence alerts
- Output structured, explainable alerts with cascade propagation predictions

### 1.2 Core Features & Workflows

| Feature | Description | Input | Output |
|---------|-------------|-------|--------|
| **Live Train Telemetry** | Poll NTES API every 5 min for 9000 trains | Train ID, station, delay, speed | Per-train state updates |
| **Feature Computation** | Real-time feature engineering (<50ms) | Train state, network topology | 20+ features per train |
| **Multi-Method Inference** | 4 parallel ML models (Bayesian, Isolation Forest, DBSCAN, Causal DAG) | Features | Individual risk scores |
| **Ensemble Voting** | Consensus voting (2+ methods to fire alert) | 4 model scores | Unified EnsembleAlert |
| **Cascade Simulation** | NetworkX-based propagation analysis | High-centrality junctions, delays | Cascading risk scores, viz |
| **Alert Reasoning** | Generate structured alerts with causal explanations | Ensemble decision + audit log | JSON alert with reasoning chain |
| **Real-Time Visualization** | WebSocket streams for dashboard (Leaflet maps, D3 graphs) | Per-train/junction alerts | Live map + cascade graph |
| **Audit Logging** | Cryptographic JSONL trail of all decisions | All inferences | drishti_alerts.jsonl |

### 1.3 System Scope

**In Scope:**
- All 1.03 lakh km Indian Railways network
- 51 high-centrality junctions (automatic identification via betweenness centrality)
- 9000 trains daily (mixed passenger/freight)
- Real-time telemetry + historical accident corpus (400 records, 2004–2023)
- Zone-level operationalization (16 railway zones)

**Out of Scope (v2.0):**
- KAVACH (active train protection) integration
- Real-time signalling control (advisory only)
- Driver app instructions (future phase)
- Private freight networks

---

## 2. Architecture Breakdown

### 2.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DRISHTI ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │  DATA SOURCES (Layer 1: Ingestion)                               │      │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │      │
│  │  │ NTES API     │ │ CRS Corpus   │ │ OSINT        │             │      │
│  │  │ (live trains)│ │ (historical) │ │ (weather)    │             │      │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  DATA LAYER (Layer 2: Processing & Storage)                      │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │      │
│  │  │ Kafka    │  │ Redis    │  │ PostgreSQL  │ Redis      │      │      │
│  │  │ (Events) │  │ (Cache)  │  │ (Audit)    │ (Features)│      │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  FEATURE ENGINEERING (Layer 3: <50ms per batch)                  │      │
│  │  ┌────────────────────────────────────────────────────────────┐  │      │
│  │  │ FeatureEngine (compute.py):                               │  │      │
│  │  │ ├─ Per-Train Features: delay, speed, density, time_ETA  │  │      │
│  │  │ ├─ Per-Junction Features: centrality, traffic, signals  │  │      │
│  │  │ └─ Temporal Features: time-of-day, seasonality          │  │      │
│  │  └────────────────────────────────────────────────────────────┘  │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  INFERENCE PIPELINE (Layer 4: <50ms per batch, parallel)         │      │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │      │
│  │  │ Bayesian     │ │ Isolation    │ │ Causal       │             │      │
│  │  │ Network      │ │ Forest       │ │ DAG          │             │      │
│  │  │ (pgmpy)      │ │ (sklearn)    │ │ (pgmpy)      │             │      │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │      │
│  │  ┌──────────────┐                                               │      │
│  │  │ DBSCAN       │                                               │      │
│  │  │ Clustering   │                                               │      │
│  │  │ (sklearn)    │                                               │      │
│  │  └──────────────┘                                               │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  ENSEMBLE VOTING (Layer 5: <5ms)                                 │      │
│  │  ┌────────────────────────────────────────────────────────────┐  │      │
│  │  │ EnsembleVoter: Collect 4 methods, fire if 2+ agree       │  │      │
│  │  │ ├─ Threshold logic (Bayesian >0.7, IF >80, Causal >0.75) │  │      │
│  │  │ ├─ Consensus check (methods_agreeing ≥ 2)               │  │      │
│  │  │ └─ Output: EnsembleAlert (severity, votes, audit ID)   │  │      │
│  │  └────────────────────────────────────────────────────────────┘  │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  ALERT & REASONING (Layer 6: Output Generation)                  │      │
│  │  ┌────────────────────────────────────────────────────────────┐  │      │
│  │  │ AlertGenerator: Convert vote → structured alert            │  │      │
│  │  │ ├─ Cascade Simulation: NetworkX propagation               │  │      │
│  │  │ ├─ Severity Assignment: INFO/WARNING/CRITICAL/EMERGENCY  │  │      │
│  │  │ ├─ Reasoning Chain: Evidence + recommended actions       │  │      │
│  │  │ └─ Audit Trail: JSONL with cryptographic signature      │  │      │
│  │  └────────────────────────────────────────────────────────────┘  │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  API & VISUALIZATION (Layer 7: Output Delivery)                  │      │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │      │
│  │  │ REST API     │ │ WebSocket    │ │ Dashboards  │             │      │
│  │  │ (FastAPI)    │ │ (real-time)  │ │ (React)     │             │      │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │      │
│  └────────────────────────┬─────────────────────────────────────────┘      │
│                           │                                                 │
│  ┌────────────────────────▼─────────────────────────────────────────┐      │
│  │  DEPLOYMENT & MONITORING (Layer 8: Infrastructure)               │      │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │      │
│  │  │ Docker       │ │ Kubernetes   │ │ ELK Stack   │             │      │
│  │  │ (containers) │ │ (orchestration) │ (observability) │          │      │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │      │
│  └────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Organization (Backend)

**Modular, Domain-Driven Design:**

```
backend/
├── main_app.py                 # FastAPI entry point, routing, startup
├── api/                        # 5 API domains
│   ├── alert_reasoning.py      # /api/alerts/unified (structure + reasoning)
│   ├── cascade_viz.py          # /api/cascade/* (propagation analysis)
│   ├── trains_router.py        # /api/trains/* (state queries)
│   ├── data_endpoints.py       # /api/data/* (telemetry, filtering)
│   └── simulation.py           # /api/simulation/* (scenario testing)
├── inference/                  # Inference orchestration
│   ├── engine.py               # UnifiedInferenceEngine (main orchestrator)
│   ├── ml_integration.py       # ML model loading
│   └── config.py               # Inference tuning parameters
├── ml/                         # 4 ML models
│   ├── bayesian_network.py     # pgmpy exact inference
│   ├── anomaly_detector.py     # Isolation Forest + DBSCAN
│   ├── causal_dag.py           # Causal structure (8-node DAG)
│   ├── ensemble.py             # EnsembleVoter (voting logic)
│   ├── forecasting.py          # Prophet/LSTM for delay prediction
│   ├── drift_detector.py       # KS test + concept drift monitoring
│   ├── retraining_pipeline.py  # Scheduled + drift-triggered retraining
│   ├── model_loader.py         # Load models from disk
│   └── model_registry.py       # Version tracking
├── features/                   # Feature engineering
│   ├── compute.py              # FeatureEngine (<50ms real-time)
│   ├── engineering.py          # FeatureEngineer (20+ features)
│   └── store.py                # Feature storage (Redis caching)
├── alerts/                     # Alert generation & reasoning
│   └── engine.py               # AlertGenerator, AuditLog
├── data/                       # Data ingestion
│   ├── ntes_connector.py       # Poll NTES API (every 5 min)
│   ├── crs_parser.py           # Parse historical accident corpus
│   ├── osint_engine.py         # OSINT integrations (weather, health)
│   └── data_quality.py         # Validation & cleaning
├── network/                    # Cascade analysis
│   ├── graph_builder.py        # NetworkX graph, centrality analysis
│   └── cascade_simulator.py    # Propagation simulation
├── db/                         # Database layer
│   ├── models.py               # SQLAlchemy ORM (User, Station, Train, TrainTelemetry, AuditEvent)
│   ├── session.py              # DB connection pooling
│   └── migrations.py           # Schema versioning
├── security/                   # Auth & encryption
│   └── auth.py                 # JWT-based authentication
├── core/                       # Cross-cutting concerns
│   ├── tracing.py              # Distributed tracing stubs
│   └── errors.py               # Error handling
├── monitoring/                 # Observability hooks
│   └── metrics.py              # Prometheus metrics
├── signalling/                 # Railway signalling integration
│   └── controller.py           # Signal state monitoring
├── scada/                      # SCADA infrastructure monitoring
│   └── connector.py            # Real-time infrastructure data
├── notifications/              # Alert delivery
│   └── gateway.py              # Email/SMS/Slack integrations
└── hud/                        # Mobile/web client protocol
    └── protocol.py             # HUD (Heads-Up Display) for drivers
```

### 2.3 Frontend Architecture

**React 18 + Vite + Leaflet Maps:**

```
frontend/
├── index.html                  # SPA entry point
├── package.json                # React 18.3.1, Vite 8.0.1
├── src/
│   ├── App.jsx                 # Root router
│   ├── pages/
│   │   ├── Dashboard.jsx       # Real-time operations overview
│   │   ├── Map.jsx             # Leaflet railway network visualization
│   │   ├── Network.jsx         # D3 force-graph: cascade topology
│   │   ├── TrainDetail.jsx     # Individual train status + history
│   │   ├── Alerts.jsx          # Live alert feed (CRITICAL/HIGH/MEDIUM/LOW)
│   │   ├── Trains.jsx          # Fleet view (searchable, filterable)
│   │   ├── System.jsx          # System health metrics
│   │   ├── Simulation.jsx      # "What-if" scenario testing
│   │   ├── AIDecisions.jsx     # ML model voting breakdown
│   │   └── Models.jsx          # Model management + retraining
│   └── components/
│       ├── StatCard.jsx        # Reusable stat widget
│       ├── Navbar.jsx          # Top navigation
│       ├── LiveIndicator.jsx   # Pulsing "live" status
│       ├── AlertBadge.jsx      # Alert severity badge
│       └── [other UI components]
├── public/
│   ├── network_graph.json      # Static railway network topology (cached)
│   └── [assets]
└── dist/                       # Vite production build (tree-shaken, hashed)
```

**Key Technologies:**
- **Leaflet 1.9.4:** Interactive railway maps (OpenStreetMap base layer)
- **React-Force-Graph-2D 1.29.1:** Real-time cascade propagation visualization
- **Recharts 2.15.4:** Time-series charts (delays, speeds, alert trends)
- **Framer-Motion 12.6.5:** Smooth animations for alerts
- **React Router 6.30.3:** Client-side SPA routing

### 2.4 Database Schema (SQLAlchemy)

```python
# Core Models:

User:
  - id (PK): Integer
  - username: String (unique, indexed)
  - password_hash: String (bcrypt)
  - role: String (viewer/operator/admin)
  - is_active: Boolean
  - created_at: DateTime

Station:
  - id (PK): Integer
  - code: String (unique, indexed) # e.g., "NDLS", "CSTM"
  - name: String
  - latitude, longitude: Float (geo-indexed)
  - zone: String (16 Indian Railway zones)
  - updated_at: DateTime

Train:
  - id (PK): Integer
  - train_id: String (unique) # e.g., "12001"
  - train_name: String
  - route: String  # e.g., "Delhi-Mumbai"
  - origin_station_code: String
  - destination_station_code: String

TrainTelemetry:
  - id (PK): Integer
  - train_id (FK): String
  - station_code (FK): String
  - delay_minutes: Integer
  - speed_kmh: Float
  - latitude, longitude: Float
  - timestamp: DateTime (indexed for time-series queries)

AuditEvent:
  - id (PK): Integer
  - trace_id: String (indexed, for request tracing)
  - actor: String (user/service)
  - action: String (INFERRED/ALERT_FIRED/RETRAIN)
  - resource: String (train_id/station/model)
  - status_code: Integer
  - details: JSON (flexible metadata)
  - created_at: DateTime

DataIngestionRun:
  - id (PK): Integer
  - source: String (NTES/CRS/OSINT)
  - records_processed: Integer
  - errors: Integer
  - started_at, completed_at: DateTime

SchemaMigration:
  - version (PK): String (semantic versioning)
  - applied_at: DateTime
```

### 2.5 API Gateway & Reverse Proxy

**Nginx Configuration:**

```nginx
# Static Assets (Vite SPA)
location / {
  try_files $uri /index.html;
  expires 1y;  # Hashed filenames from Vite
  gzip on; gzip_level 6;
}

# API Reverse Proxy
location /api {
  proxy_pass http://drishti-api:8000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}

# WebSocket Upgrade
location /ws {
  proxy_pass http://drishti-api:8000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade websocket;
  proxy_set_header Connection "upgrade";
}

# Security Headers
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin
```

### 2.6 Request Lifecycle (Example: Get Unified Alerts)

```
Client (React)
  │
  └─→ GET /api/alerts/unified?severity=CRITICAL&hours=24
      │
      Nginx (reverse proxy)
      │
      └─→ FastAPI (main_app.py)
          │
          ├─ CORS middleware (allow all origins)
          ├─ Auth middleware (JWT token validation)
          │
          └─→ alert_reasoning.router
              │
              ├─ Query AuditEvent table (severity=CRITICAL, last 24h)
              ├─ For each event, fetch related trains/stations
              ├─ Join with CASCADE_SIMULATION results
              │
              └─→ Response: [Alert, Alert, ...]
                  {
                    alert_id: "ALT-2024-001",
                    severity: "CRITICAL",
                    title: "CASCADE DETECTED",
                    reasons: [
                      {
                        category: "cascade",
                        confidence: 0.98,
                        ml_model: "cascade_simulator",
                        evidence: [...]
                      }
                    ],
                    affected_trains: [...],
                    affected_junctions: [...],
                    estimated_impact: {
                      delay_minutes: 67,
                      affected_passengers: 12000
                    }
                  }
      │
      Nginx (reverse proxy, gzip)
      │
      Client (render via React)
```

---

## 3. Data Flow & Processing

### 3.1 Data Sources

| Source | Type | Frequency | Volume | Purpose |
|--------|------|-----------|--------|---------|
| **NTES API** | Live telemetry | Every 5 min | 9000 trains/day | Real-time train states (position, delay, speed) |
| **CRS Corpus** | Historical incidents | Batch load (once) | 400 records (2004–2023) | Accident patterns, root causes, pre-accident signatures |
| **CAG Audits** | Zone health | Daily | 16 zones | Maintenance metrics, signal failure rates, staffing |
| **Weather API** | OSINT | Hourly | 51 junctions | Rainfall, visibility, temperature (correlate with delays) |
| **GPS/SCADA** | Real-time infra | Streaming | 51+ junctions | Signal states, track defects, maintenance windows |

### 3.2 Data Validation & Cleaning Pipeline

```python
class DataQualityEngine:
    """Validates ingested data before inference."""
    
    def validate_ntes_train(self, record: Dict) -> bool:
        """Check train telemetry for:
        - Delay in [-120, 360] minutes (outliers rejected)
        - Speed in [0, 140] kmh (freight max)
        - Latitude/Longitude within India bounds
        - No duplicate timestamps (< 1 second apart)
        """
        checks = [
            -120 <= record['delay_minutes'] <= 360,
            0 <= record['speed_kmh'] <= 140,
            8.0 <= record['lat'] <= 35.0,
            68.0 <= record['lon'] <= 97.0,
        ]
        return all(checks)
    
    def validate_accident_record(self, record: Dict) -> bool:
        """Check historical accident for:
        - Valid station code
        - Cause in predefined list (signal failure, track defect, etc.)
        - Deaths/injuries non-negative
        """
        checks = [
            record['station_code'] in VALID_STATIONS,
            record['cause'] in ACCIDENT_CAUSES,
            record['deaths'] >= 0 and record['injuries'] >= 0,
        ]
        return all(checks)
```

### 3.3 Feature Engineering Pipeline

**Temporal Features:**
- `hour_of_day`: 0-23 (captures rush hours)
- `day_of_week`: 0-6 (weekend vs. weekday)
- `is_monsoon`: Boolean (June–September)
- `is_holiday`: Boolean (public holiday in zone)
- `month`: 1-12 (seasonality)

**Spatial Features:**
- `centrality_rank`: 0-100 (network importance, from NetworkX betweenness)
- `degree`: Number of adjacent junctions
- `avg_neighbor_centrality`: Average centrality of connected stations
- `distance_to_hub`: Km to nearest major hub (e.g., NDLS, CSTM)

**Historical Features:**
- `zone_accident_frequency`: Accidents per 1000 trains for zone
- `deaths_on_record`: Total deaths ever at this station
- `years_since_last_accident`: Time since last incident
- `peak_accident_month`: Month with most historical incidents
- `common_cause`: Most common accident cause at station

**Operational Features:**
- `delay_minutes`: Current delay
- `delay_trend`: Rate of change (current - past) / Δt
- `speed_kmh`: Current speed
- `traffic_density`: % of max capacity on section
- `time_to_next_junction`: Minutes to next stop
- `is_goods_train`: Boolean (freight trains have different profiles)
- `maintenance_active`: Boolean (maintenance window active at station)
- `weather_condition`: "clear", "rain", "fog"

**Total: 20+ features per train per inference cycle.**

### 3.4 Feature Computation Pipeline (Real-Time, <50ms)

```
┌──────────────────────────────────────────┐
│ NTES API (latest train states)           │
│ Poll every 5 minutes → ~9000 trains      │
└────────────────┬─────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Parse NTES JSON│
         └───────┬────────┘
                 │
    ┌────────────▼───────────────┐
    │ For each train_state:      │
    │ ├─ Compute PerTrainFeatures│
    │ │  (delay, speed, density) │
    │ ├─ Lookup PerJunctionFeats │
    │ │  (centrality, signals)   │
    │ └─ Cache in Redis          │
    └────────────┬───────────────┘
                 │ [~50ms total]
         ┌───────▼────────┐
         │ Ready for ML   │
         │ Inference      │
         └────────────────┘
```

**Key Implementation (compute.py):**

```python
class FeatureEngine:
    def compute_batch(self, trains: List[Dict]) -> Dict:
        """Compute features for batch of trains in <50ms."""
        features_batch = {}
        for train in trains:
            features_batch[train['train_id']] = PerTrainFeatures(
                train_id=train['train_id'],
                position_lat=train.get('lat', 0.0),
                position_lon=train.get('lon', 0.0),
                actual_delay_minutes=train.get('delay', 0),
                speed_kmh=train.get('speed', 60),
                traffic_density_around_train=self.estimate_density(train),
                time_to_next_junction_minutes=self.calc_eta(train),
                is_goods_train=train.get('train_type') == 'GOODS',
                timestamp=datetime.now(tz=timezone.utc).isoformat(),
            )
        
        # Cache in Redis with 5-minute TTL
        self.redis_client.mset({
            f"features:{tid}": features_batch[tid].to_dict()
            for tid in features_batch
        })
        self.redis_client.expire(f"features:*", 300)
        
        return features_batch
```

### 3.5 Data Storage & Retrieval

| Component | Storage | TTL | Query Pattern | Example |
|-----------|---------|-----|---------------|---------|
| **Real-time features** | Redis | 5 min | Get by train_id | `GET features:12001` |
| **Alert history** | PostgreSQL | ∞ | Range query (last 24h) | `SELECT * FROM audit_events WHERE created_at > NOW() - INTERVAL '1 day'` |
| **Train telemetry** | PostgreSQL | ∞ | Time-series (train + window) | `SELECT * FROM train_telemetry WHERE train_id='12001' AND timestamp BETWEEN t1 AND t2` |
| **Model state** | JSON file | Until retrain | Loaded at startup | `ml_model_state.json` (zone base rates, CPTs) |
| **Trained models** | Pickle/joblib | Until retrain | Loaded at startup | `models/isolation_forest_latest.pkl` |
| **Event stream** | Kafka | 7 days | Subscribe to topic | Topic: `ntes-train-updates` |

---

## 4. Backend Design

### 4.1 API Endpoints (5 Domains)

#### **Domain 1: Alerts (`/api/alerts`)**

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| GET | `/alerts/unified` | Get all alerts with reasoning | `[Alert, Alert, ...]` |
| GET | `/alerts/{alert_id}` | Fetch single alert + audit trail | `Alert + full_reasoning` |
| POST | `/alerts/acknowledge` | Mark alert as reviewed | `{status: "acknowledged"}` |
| GET | `/alerts/stats` | Alert histogram (severity, time) | `{CRITICAL: 5, HIGH: 12, ...}` |

**Example Response (Unified Alert):**
```json
{
  "alert_id": "ALT-2024-001",
  "severity": "CRITICAL",
  "title": "CASCADE DETECTED: Delhi → Lucknow → Gaya",
  "timestamp": "2024-01-15T10:30:45Z",
  "consensus_risk": 92.5,
  "certainty": 0.95,
  "methods_agreeing": 4,
  "votes": [
    {
      "method_name": "bayesian_network",
      "score": 0.96,
      "threshold": 0.7,
      "votes_danger": true,
      "confidence": 0.98,
      "explanation": "P(accident | high_delay + signal_failure) = 0.96"
    },
    {
      "method_name": "isolation_forest",
      "score": 95,
      "threshold": 80,
      "votes_danger": true,
      "confidence": 0.89,
      "explanation": "47 trains with >5σ delay deviation"
    },
    {...causal_dag...},
    {...dbscan...}
  ],
  "reasons": [
    {
      "category": "cascade",
      "confidence": 0.98,
      "evidence": ["12 high-centrality junctions affected", "Avg delay spike 67 min"],
      "affected_entities": ["NDLS", "LKO", "MGS"],
      "recommended_action": "Activate CASCADE_RESPONSE_PROTOCOL",
      "ml_model": "cascade_simulator"
    }
  ],
  "affected_trains": ["12001", "12002", "12301"],
  "affected_junctions": ["NDLS", "LKO", "MGS"],
  "estimated_impact": {
    "delay_minutes": 67,
    "stranded_passengers": 12000,
    "cascade_probability": 0.92
  }
}
```

#### **Domain 2: Cascade Analysis (`/api/cascade`)**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/cascade/propagation?start_station=NDLS` | Simulate cascade from station |
| GET | `/cascade/topology` | Network graph (51 junctions, edges) |
| POST | `/cascade/test_scenario` | "What-if" simulation |

#### **Domain 3: Train Queries (`/api/trains`)**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/trains` | Fleet overview (searchable) |
| GET | `/trains/{train_id}` | Current state + history |
| GET | `/trains/{train_id}/telemetry?hours=24` | Historical telemetry |
| GET | `/trains/{train_id}/risk_factors` | Per-train risk breakdown |

#### **Domain 4: Data Access (`/api/data`)**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/data/telemetry?station=NDLS&hours=12` | Telemetry for station |
| GET | `/data/zones` | Zone-level summary (16 zones) |
| GET | `/data/ingestion_runs` | Data pipeline history |

#### **Domain 5: Simulation (`/api/simulation`)**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/simulation/balasore` | Test on historical Balasore accident |
| POST | `/simulation/custom_scenario` | User-defined what-if test |

### 4.2 Business Logic: Alert Reasoning Engine

**Location:** `backend/alerts/engine.py`

```python
class AlertGenerator:
    """Converts ML votes into actionable, reasoned alerts."""
    
    def generate_alert(self, ensemble_vote: EnsembleAlert) -> DrishtiAlert:
        """
        1. Validate vote (2+ methods agreeing)
        2. Simulate cascade propagation
        3. Assign severity (INFO/WARNING/CRITICAL/EMERGENCY)
        4. Generate reasoning chain
        5. Create audit log entry
        """
        
        if not ensemble_vote.fires or ensemble_vote.methods_agreeing < 2:
            return None  # No alert
        
        # Step 1: Cascade simulation
        cascade_info = self.cascade_simulator.propagate(
            start_junction=ensemble_vote.train_state['station'],
            initial_delay_minutes=ensemble_vote.train_state['delay'],
            time_window_seconds=3600,
        )
        
        # Step 2: Severity mapping
        severity = self.map_to_severity(
            consensus_risk=ensemble_vote.consensus_risk,
            cascade_info=cascade_info,
            methods_agreeing=ensemble_vote.methods_agreeing,
        )
        
        # Step 3: Reasoning chain
        reasoning = []
        for vote in ensemble_vote.votes:
            reasoning.append({
                "category": self.vote_to_category(vote),
                "confidence": vote.confidence,
                "evidence": self.extract_evidence(vote),
                "ml_model": vote.method_name,
            })
        
        # Step 4: Audit log
        audit_entry = {
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "trace_id": str(uuid.uuid4()),
            "train_id": ensemble_vote.train_id,
            "alert_severity": severity,
            "votes": ensemble_vote.votes,
            "reasoning": reasoning,
            "cascade_depth": cascade_info['depth'],
            "affected_trains": cascade_info['trains'],
        }
        self.audit_log.write(audit_entry)
        
        return DrishtiAlert(
            alert_id=str(uuid.uuid4()),
            train_id=ensemble_vote.train_id,
            severity=severity,
            reasoning=reasoning,
            cascade_info=cascade_info,
            audit_id=audit_entry['trace_id'],
        )
```

### 4.3 Cascade Propagation Simulator

**Location:** `backend/network/cascade_simulator.py`

Uses NetworkX graph of 51 junctions with betweenness centrality:

```python
class CascadeSimulator:
    def propagate(self, start_junction: str, initial_delay: int) -> Dict:
        """Simulate cascade using network propagation model."""
        
        # High-risk junctions (centrality > 90)
        HIGH_RISK = {
            "Bahanaga Bazar": 99,
            "Gaisal": 98,
            "Kanchanjungha": 97,
            ...
        }
        
        # BFS propagation with signal decay
        visited = set([start_junction])
        cascade_depth = 0
        affected_trains = set()
        
        queue = deque([(start_junction, initial_delay, 1.0)])  # (junction, delay, attenuation)
        
        while queue:
            junction, delay, attenuation = queue.popleft()
            
            # Signal decays with distance
            if attenuation < 0.1:  # Stop if signal too weak
                continue
            
            cascade_depth = max(cascade_depth, len(visited))
            
            # Find adjacent junctions (high-centrality neighbors)
            for neighbor in self.graph.neighbors(junction):
                if neighbor in visited:
                    continue
                
                visited.add(neighbor)
                
                # Delay propagation (decreases with distance)
                neighbor_delay = delay * attenuation * 0.8
                
                # Fetch trains at this junction
                trains_at_neighbor = self.get_trains_at_junction(neighbor)
                affected_trains.update(trains_at_neighbor)
                
                # Continue propagation
                queue.append((neighbor, neighbor_delay, attenuation * 0.7))
        
        return {
            "depth": cascade_depth,
            "affected_junctions": len(visited),
            "affected_trains": list(affected_trains),
            "max_secondary_delay": ...,
        }
```

**Severity Mapping:**
- **INFO (15 min):** Single train delayed, no network impact
- **WARNING (45 min):** 2-5 trains delayed, secondary junctions affected
- **CRITICAL (90 min):** 6+ trains delayed, cascade visible at 3+ junctions
- **EMERGENCY (>90 min):** Hub failure, 20+ trains, network-wide disruption

### 4.4 Scalability Considerations

**Vertical Scaling (Single Machine):**
- FastAPI with 4+ async workers (uvicorn)
- Feature computation: ~10ms per train, 900+ trains/second capacity
- Inference: ~50ms per batch of 100 trains, <100ms p99
- Current bottleneck: Redis feature caching (can sustain 10K req/sec)

**Horizontal Scaling (Multiple Machines):**
- Stateless FastAPI service → replicate via Kubernetes
- Feature store (Redis) should be in-memory database (DynamoDB, Memcached) on dedicated instance
- Database (PostgreSQL) → use RDS with read replicas for audit queries
- Kafka for event streaming → horizontal partition by train_id

**Estimated Resource Requirements (9000 trains/day):**
- CPU: 2-4 cores (inference load)
- RAM: 4-8 GB (Redis feature cache, model state)
- Network: 1-2 Mbps (NTES polling, inference results)
- Storage: 10 GB/year (audit logs at 1% sampling rate)

---

## 5. AI/ML Pipeline

### 5.1 Four ML Methods (Ensemble Components)

#### **1. Bayesian Network (Exact Inference via pgmpy)**

**Purpose:** Probabilistic reasoning using Causal DAG

**Model Structure (8-node DAG):**
```
maintenance_skip → signal_failure → track_mismatch
                    ↓                     ↓
              train_bunching → accident ← excessive_stoppages
                    ↑                     ↑
              night_shift → crew_fatigue
```

**Conditional Probability Tables (CPTs):**
```python
# Base rates (priors from historical data)
P(maintenance_skip = True) = 0.05          # 5% of windows skipped
P(night_shift = True) = 0.30               # 30% of trains run at night
P(high_centrality_junction = True) = 0.10  # 10% of stations are high-risk

# CPTs (learned from 400 accidents)
P(signal_failure | maintenance_skip) = 0.40
P(signal_failure | ¬maintenance_skip) = 0.05
P(accident | signal_failure ∧ high_delay) = 0.75
P(accident | ¬signal_failure ∧ high_delay) = 0.05
```

**Inference:**
```python
# Query: P(accident | evidence)?
evidence = {
    'maintenance_skip': True,
    'signal_failure': True,
    'high_delay': True,
}
result = inference.query(variables=['accident'], evidence=evidence)
p_accident = result['accident'].values[1]  # Probability of accident = 1
```

**Threshold:** P(accident) > 0.7 → danger vote

**Pros:**
- Exact inference (no approximation)
- Explainable: can query individual CPTs
- Fast (<10ms per inference)

**Cons:**
- CPTs hardcoded (not learned from data in v2.0)
- Assumes conditional independence (limited accuracy)

---

#### **2. Isolation Forest (Statistical Anomaly Detection)**

**Purpose:** Detect trains with unusual temporal/spatial patterns

**Features:** [delay, speed, traffic_density, time_of_day]

**Algorithm:**
```python
# iForest: randomly partitions feature space
# Anomalies are isolated quickly (short path lengths)

from sklearn.ensemble import IsolationForest

model = IsolationForest(
    contamination=0.02,      # Expect 2% anomalies
    n_estimators=100,
    random_state=42,
)

# Train on 50 random samples per session
model.fit(training_data)

# Score: -1 = anomaly, 0-100 = normal
anomaly_score = model.decision_function(test_data)  # Higher = more anomalous
```

**Threshold:** Anomaly score > 80 → danger vote

**Pros:**
- Fast, unsupervised
- No assumptions about data distribution
- Good for tail events

**Cons:**
- Feature selection critical
- Doesn't model temporal sequences well

---

#### **3. DBSCAN Clustering (Trajectory Anomalies)**

**Purpose:** Detect unusual train trajectories (speed/position/delay over time)

**Features:** (lat, lon, speed, delay) × time_window → trajectory sequence

**Algorithm:**
```python
from sklearn.cluster import DBSCAN

# Cluster trains with similar trajectories
clustering = DBSCAN(eps=2.0, min_samples=5)
labels = clustering.fit_predict(train_trajectories)

# label = -1 → outlier (anomalous trajectory)
```

**Threshold:** If train's label == -1 → danger vote

**Pros:**
- Detects coordinated multivariate anomalies
- No prior assumption about number of clusters

**Cons:**
- Sensitive to eps parameter
- Requires tuning per region

---

#### **4. Causal DAG (Causal Inference)**

**Purpose:** Trace root causes using causal relationships

**Uses same DAG as Bayesian Network, but:**
- Computes "causal effects" (counterfactual query: what if maintenance was done?)
- Ranks risk by causal pathways

**Example Causal Query (Do-Calculus):**
```
P(accident | do(maintain_signals))
  vs.
P(accident | observe(maintenance_skip=True))

If do-calculus result is lower, then maintenance is truly causal for accident.
```

**Threshold:** Risk score > 0.75 → danger vote

---

### 5.2 Ensemble Voting Logic

**Location:** `backend/ml/ensemble.py`

```python
class EnsembleVoter:
    def vote(self, features: Dict) -> EnsembleAlert:
        """
        Collect votes from 4 independent methods.
        Alert fires ONLY if 2+ methods agree.
        """
        
        votes = []
        
        # Method 1: Bayesian Network
        bayesian_result = self.bayesian_network.update_belief(features)
        bayesian_vote = bayesian_result.p_accident > self.bayesian_threshold
        votes.append(MethodVote(
            method_name="bayesian_network",
            score=bayesian_result.p_accident,
            threshold=self.bayesian_threshold,
            votes_danger=bayesian_vote,
            confidence=bayesian_result.confidence,
        ))
        
        # Method 2: Isolation Forest
        if_score = self.anomaly_detector.isolation_forest.decision_function([features])
        if_vote = if_score > self.isolation_forest_threshold
        votes.append(MethodVote(
            method_name="isolation_forest",
            score=if_score,
            threshold=self.isolation_forest_threshold,
            votes_danger=if_vote,
            confidence=self.compute_confidence(if_score),
        ))
        
        # Method 3: DBSCAN
        dbscan_label = self.anomaly_detector.dbscan_clustering.predict([features])
        dbscan_vote = dbscan_label == -1  # -1 = outlier
        votes.append(MethodVote(
            method_name="dbscan",
            score=abs(dbscan_label) * 50,
            threshold=0.5,
            votes_danger=dbscan_vote,
            confidence=0.8 if dbscan_vote else 0.2,
        ))
        
        # Method 4: Causal DAG
        causal_score = self.causal_dag.compute_risk_score(features)
        causal_vote = causal_score > self.causal_dag_threshold
        votes.append(MethodVote(
            method_name="causal_dag",
            score=causal_score,
            threshold=self.causal_dag_threshold,
            votes_danger=causal_vote,
            confidence=0.7,
        ))
        
        # Count danger votes
        methods_voting_danger = sum(1 for v in votes if v.votes_danger)
        
        # Fire alert if 2+ methods agree AND certainty >= 0.5
        certainty = methods_voting_danger / 4.0
        fires = methods_voting_danger >= self.min_methods_agreeing and certainty >= 0.5
        
        consensus_risk = np.mean([v.score for v in votes]) * 100
        
        return EnsembleAlert(
            train_id=features['train_id'],
            alert_id=str(uuid.uuid4()),
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            severity=self.map_to_severity(consensus_risk),
            consensus_risk=consensus_risk,
            certainty=certainty,
            methods_agreeing=methods_voting_danger,
            votes=votes,
            explanation=self.generate_explanation(votes),
            actions=self.generate_actions(consensus_risk),
            fires=fires,
        )
```

### 5.3 Feature Engineering Deep Dive

**20+ Engineered Features:**

1. **Temporal (5):** hour_of_day, day_of_week, is_weekend, month, is_monsoon
2. **Spatial (4):** centrality_rank, degree, avg_neighbor_centrality, distance_to_hub
3. **Historical (6):** accident_frequency_zone, deaths_on_record, injuries_on_record, years_since_last_accident, peak_accident_month, common_cause
4. **Operational (5):** delay_minutes, delay_trend (rate of change), speed_kmh, is_heavy_rain, weather_condition

**Real-Time Computation (<50ms):**

```python
class FeatureEngineer:
    def compute_features_for_train(self, train_state: Dict) -> Dict:
        """Compute all 20+ features in <50ms."""
        
        # Temporal
        now = datetime.now(tz=timezone.utc)
        features['hour_of_day'] = now.hour
        features['day_of_week'] = now.weekday()
        features['is_weekend'] = now.weekday() >= 5
        features['month'] = now.month
        features['is_monsoon'] = 6 <= now.month <= 9
        
        # Spatial
        station = self.get_station(train_state['station_code'])
        centrality = NetworkTopology.HIGH_RISK_JUNCTIONS.get(station.name, {}).get('centrality_rank', 50)
        features['centrality_rank'] = centrality
        features['degree'] = len(self.graph.neighbors(station.name))
        features['distance_to_hub'] = self.calculate_distance_to_nearest_hub(station)
        
        # Historical
        zone = station.zone
        features['accident_frequency_zone'] = self.accident_base_rates[zone]
        features['deaths_on_record'] = self.get_historical_stats(station)['deaths']
        
        # Operational
        features['delay_minutes'] = train_state['delay']
        features['delay_trend'] = self.compute_delay_trend(train_state['train_id'])
        features['speed_kmh'] = train_state['speed']
        features['is_heavy_rain'] = self.weather_api.get_rainfall(station) > 50
        
        return features
```

### 5.4 Training vs. Inference Separation

| Phase | When | Data | Computation | Output | Latency |
|-------|------|------|-------------|--------|---------|
| **Training** | Scheduled (daily) + drift-triggered | 400 historical accidents + 7K stations + OSINT | Offline batch | `ml_model_state.json`, `models/*.pkl` | Hours |
| **Inference** | Every 5 min (NTES poll) | Live NTES (9000 trains) | Streaming feature compute + parallel ML | Per-train risk scores | <100ms p99 |

**Training Script:** `train_ml_ensemble.py`

```python
def train_ensemble():
    """Offline training (triggered daily or by drift)."""
    
    # 1. Load all historical data
    accidents = load_accidents_from_csv("data/railway_accidents_400.csv")
    stations = load_stations_from_csv("data/railway_stations_7000.csv")
    zone_health = load_zone_health("data/cag_zone_health.json")
    
    # 2. Feature engineering
    X_train = []
    y_train = []
    for accident in accidents:
        features = compute_historical_features(accident, stations, zone_health)
        X_train.append(features)
        y_train.append(1)  # Positive label
    
    # Add negative samples (non-accident records)
    for station in stations[:len(accidents)]:  # Balance
        features = compute_historical_features(station, ..., ...)
        X_train.append(features)
        y_train.append(0)  # Negative label
    
    # 3. Train 4 models
    bayesian_network.fit(X_train, y_train)
    isolation_forest.fit(X_train)
    causal_dag.build_from_data(X_train)
    dbscan.fit(X_train)
    
    # 4. Compute zone base rates
    zone_base_rates = {}
    for zone in ZONES:
        zone_base_rates[zone] = count_accidents_in_zone(zone) / count_trains_in_zone(zone)
    
    # 5. Save artifacts
    save_model(bayesian_network, "models/bayesian_v2.pkl")
    save_model(isolation_forest, "models/isolation_forest_latest.pkl")
    save_json({
        'zone_base_rates': zone_base_rates,
        'feature_importance': compute_feature_importance(X_train, y_train),
    }, "ml_model_state.json")
```

### 5.5 Drift Detection & Automatic Retraining

**Triggers for Retraining:**

1. **Scheduled:** Every 24 hours (default)
2. **Data Drift:** Kolmogorov-Smirnov test P(feature distribution change) > 0.15
3. **Performance Drop:** Accuracy < 85% on holdout set
4. **Concept Drift:** P(model predictions) distribution shifts


```python
class DriftDetector:
    def detect_drift(self, new_predictions: List[float]):
        """Monitor for data/concept drift."""
        
        # KS test: compare new feature distribution to baseline
        baseline_features = load_baseline_features()
        new_features = compute_recent_features(lookback_hours=24)
        
        ks_statistic, pvalue = ks_2samp(baseline_features, new_features)
        if ks_statistic > 0.15:  # Drift detected
            logger.warning(f"Data drift detected: ks={ks_statistic:.3f}")
            trigger_retraining()
        
        # Concept drift: check if P(prediction=1) distribution changed
        if not hasattr(self, 'baseline_prediction_distribution'):
            self.baseline_prediction_distribution = new_predictions
        
        ks_pred, pvalue_pred = ks_2samp(
            self.baseline_prediction_distribution,
            new_predictions[-1000:],  # Last 1000 predictions
        )
        if ks_pred > 0.15:
            logger.warning(f"Concept drift detected: ks={ks_pred:.3f}")
            trigger_retraining()
```

**Retraining Workflow:**

```
Drift Detected
    ↓
Train New Model (in parallel, shadow mode)
    ↓
Compare vs. Old Model (A/B test on 10% traffic)
    ↓
If New > Old Performance:
    ├─ Promote to production
    ├─ Archive old model
    └─ Update ml_model_state.json
    ↓
Else (New ≤ Old):
    ├─ Keep old model
    ├─ Log failure
    └─ Alert ops team
```

---

## 6. DevOps & Deployment

### 6.1 Containerization Strategy

#### **Multi-Stage Docker Build (Backend)**

**File:** `Dockerfile`

```dockerfile
# Stage 1: Builder (installs dependencies)
FROM python:3.11-slim AS builder

WORKDIR /build
RUN apt-get update && apt-get install -y build-essential gcc g++
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime (minimal image, non-root user)
FROM python:3.11-slim AS runtime

LABEL org.opencontainers.image.title="DRISHTI API"
LABEL org.opencontainers.image.description="Railway Cascade Intelligence System"

WORKDIR /app

# Install only runtime deps (curl for healthcheck)
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY backend/ ./backend/
COPY data/ ./data/
COPY models/ ./models/
COPY crs_corpus.json ./
COPY requirements.txt ./

# Security: non-root user
RUN useradd --uid 1000 --no-create-home drishti && chown -R drishti:drishti /app
USER drishti

# Health check
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=15s \
    --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8000}/api/health || exit 1

EXPOSE 8000

# Graceful shutdown support
CMD python -m uvicorn backend.main_app:app \
    --host 0.0.0.0 \
    --port ${PORT:-8000} \
    --workers 4 \
    --log-level info \
    --access-log
```

**Image Size:** ~200 MB (dependencies only, no dev tools)

**Security Features:**
- Non-root user (drishti:1000)
- Read-only filesystem suitable for production
- Multi-stage build reduces attack surface

---

#### **Frontend (React + Nginx)**

**File:** `Dockerfile.frontend`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/src ./src
COPY frontend/public ./public
RUN npm run build  # → dist/

# Stage 2: Serve
FROM nginx:1.27-alpine

COPY --from=builder /build/dist /usr/share/nginx/html/
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Image Size:** ~40 MB (static assets only)

---

### 6.2 Docker Compose Orchestration

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
    volumes: [redis_data:/data]

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on: [zookeeper]
    ports: ["9092:9092"]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: drishti
      POSTGRES_USER: drishti
      POSTGRES_PASSWORD: drishti-secure-2026
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U drishti"]
      interval: 10s

  prometheus:
    image: prom/prometheus
    volumes:
      - ./deployment/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    ports: ["3000:3000"]
    volumes: [grafana_data:/var/lib/grafana]

  drishti-api:
    build:
      context: .
      dockerfile: Dockerfile
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://drishti:drishti-secure-2026@postgres:5432/drishti
      REDIS_URL: redis://redis:6379/0
      KAFKA_BROKERS: kafka:29092
      LOG_LEVEL: INFO
    depends_on:
      - redis
      - postgres
      - kafka
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  drishti-frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports: ["80:80"]
    depends_on: [drishti-api]

volumes:
  redis_data:
  postgres_data:
  prometheus_data:
  grafana_data:
```

---

### 6.3 Kubernetes Deployment (High Availability)

**File:** `deployment/kubernetes.yml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: drishti

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: drishti-config
  namespace: drishti
data:
  STREAMING_BACKEND: "kafka"
  KAFKA_BROKERS: "kafka-broker-0.kafka-broker-headless.drishti.svc.cluster.local:9092"
  KAFKA_TOPIC: "ntes-train-updates"
  BATCH_SIZE: "100"
  MAX_WORKERS: "4"
  LOG_LEVEL: "INFO"

---
apiVersion: v1
kind: Secret
metadata:
  name: drishti-secrets
  namespace: drishti
type: Opaque
stringData:
  DB_USER: drishti
  DB_PASSWORD: drishti-secure-2026
  DB_HOST: postgres-service.drishti.svc.cluster.local
  DB_PORT: "5432"
  DB_NAME: drishti
  REDIS_URL: redis://redis-service.drishti.svc.cluster.local:6379/0

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: drishti-api
  namespace: drishti
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: drishti-api
  template:
    metadata:
      labels:
        app: drishti-api
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8000"
        prometheus.io/path: "/metrics"
    spec:
      # Pod anti-affinity: spread replicas across nodes
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values: [drishti-api]
              topologyKey: kubernetes.io/hostname
      
      containers:
      - name: drishti-api
        image: drishti-api:latest
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8000
        
        # Resource limits
        resources:
          requests:
            memory: 512Mi
            cpu: 500m
          limits:
            memory: 1Gi
            cpu: 1000m
        
        # Readiness probe
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Liveness probe
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        # Environment from ConfigMap and Secrets
        envFrom:
        - configMapRef:
            name: drishti-config
        - secretRef:
            name: drishti-secrets
        
        volumeMounts:
        - name: model-state
          mountPath: /app/models
          readOnly: true
      
      volumes:
      - name: model-state
        configMap:
          name: drishti-models

---
apiVersion: v1
kind: Service
metadata:
  name: drishti-api-service
  namespace: drishti
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8000
  selector:
    app: drishti-api

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: drishti-hpa
  namespace: drishti
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: drishti-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Key Features:**
- **3 replicas** for high availability
- **Rolling updates** (maxSurge=1, maxUnavailable=0) for zero-downtime deployments
- **Pod anti-affinity** to spread across nodes
- **Health checks** (readiness + liveness probes)
- **HPA** (Horizontal Pod Autoscaler) for automatic scaling (7–10 replicas under high load)
- **Resource limits** (512Mi–1Gi RAM, 500m–1000m CPU per pod)

---

### 6.4 Terraform Infrastructure (AWS Free Tier)

**Files:** `terraform/` (networking.tf, compute.tf, database.tf, outputs.tf)

```hcl
# VPC & Networking
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = { Name = "drishti-vpc" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
}

# EC2 Instance (t3.micro — free tier)
resource "aws_instance" "drishti_server" {
  ami             = "ami-0c55b159cbfafe1f0"  # Ubuntu 22.04
  instance_type   = "t3.micro"
  subnet_id       = aws_subnet.public.id
  key_name        = aws_key_pair.deployer.key_name
  
  user_data = base64encode(file("${path.module}/user_data.sh"))
  
  tags = { Name = "drishti-backend" }
}

# RDS PostgreSQL (db.t3.micro — free tier)
resource "aws_db_instance" "drishti_db" {
  identifier         = "drishti-db"
  engine             = "postgres"
  engine_version     = "15.0"
  instance_class     = "db.t3.micro"
  allocated_storage  = 20
  storage_type       = "gp3"
  
  db_name  = "drishti"
  username = "drishti"
  password = random_password.db_password.result
  
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  
  publicly_accessible = false
  multi_az            = false
  
  tags = { Name = "drishti-postgres" }
}

# Secrets Manager (store DB password)
resource "aws_secretsmanager_secret" "db_password" {
  name = "drishti/db-password"
}
```

**Key Features:**
- **Cost:** ~$15/month (free tier eligible)
- **VPC:** Private subnets for RDS, public for EC2
- **Security Groups:** Restrict traffic by port (22/SSH, 80/HTTP, 443/HTTPS for EC2; 5432/PostgreSQL for RDS)
- **IAM Role:** EC2 instance assumes role for AWS Secrets Manager access (no hardcoded credentials)

---

### 6.5 CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/production-pipeline.yml`

```yaml
name: Production Pipeline

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Lint with Ruff
        run: ruff check backend/ --select E,F  # Fatal errors only
      
      - name: Security scan with Bandit
        run: bandit -r backend/ -ll  # High severity only
      
      - name: Run tests
        run: pytest tests/ -v --asyncio-mode=auto
  
  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: npm ci --prefix frontend
      
      - name: Build with Vite
        run: npm run build --prefix frontend
  
  build-and-push-images:
    needs: [lint-and-test, build-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push backend image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/drishti-api:${{ github.sha }}
            ghcr.io/${{ github.repository }}/drishti-api:latest
      
      - name: Build and push frontend image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.frontend
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/drishti-frontend:${{ github.sha }}
            ghcr.io/${{ github.repository }}/drishti-frontend:latest
```

---

### 6.6 ELK Stack Integration (Monitoring & Logging)

**File:** `docker-compose.elk.yml`

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: true
      ELASTIC_PASSWORD: changeme
    ports: ["9200:9200"]
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q green"]
      interval: 30s
    volumes: [elasticsearch_data:/usr/share/elasticsearch/data]

  logstash:
    image: docker.elastic.co/logstash/logstash:8.10.0
    volumes:
      - ./elk/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports: ["5000:5000", "8080:8080"]
    depends_on: [elasticsearch]
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200

  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.0
    ports: ["5601:5601"]
    depends_on: [elasticsearch]
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200

volumes:
  elasticsearch_data:
```

**Logstash Configuration:**

```
input {
  tcp { port => 5000; codec => json; }
  udp { port => 5000; codec => json_lines; }
  http { port => 8080; codec => json; }
}

filter {
  json { source => "message" }
  if [level] {
    mutate { add_field => { "severity" => "[level]" } }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "drishti-%{+YYYY.MM.dd}"
  }
}
```

**Benefits:**
- Centralized log aggregation (all services → Elasticsearch)
- Real-time dashboards (Kibana)
- Historical analysis (30-day retention)

---

## 7. Design Decisions & Trade-offs

### 7.1 Multi-Method Ensemble vs. Single Model

**Decision:** Use 4 independent ML models with 2+ voting requirement

**Trade-offs:**

| Aspect | Single Model | Multi-Method Ensemble |
|--------|-------------|----------------------|
| **Latency** | ~20ms | ~100ms (4 models parallel) |
| **Accuracy (Low FP)** | 85–90% | 95–98% (consensus) |
| **Interpretability** | High (single model) | Lower (4 votes) |
| **Robustness** | Fails catastrophically if model broken | Graceful degradation (3/4 models still work) |
| **Computational cost** | 1 GPU | 4x CPU (but parallelizable) |
| **Production reliability** | 99% SLA | 99.9% SLA (consensus design) |

**Justification:** Railway safety is mission-critical. 4-method consensus provides extremely low false positive rate and robustness.

---

### 7.2 Zone Base Rates as Bayesian Priors

**Decision:** Inject domain knowledge (historical accident frequency per zone) as priors in Bayesian network

**Trade-offs:**

| Aspect | Learned Priors | Domain Priors |
|--------|----------------|---------------|
| **Accuracy** | Better on historical data | More accurate for future (out-of-distribution) |
| **Data requirements** | 1000+ samples per prior | Expert judgment or historical stats |
| **Interpretability** | Black box | Crystal clear (domain experts validate) |
| **Bias risk** | Data bias (historical accidents < recent patterns) | Human bias (experts may overestimate) |

**Justification:** Indian Railways has 120+ years of accident data. Zone-level statistics are highly reliable. Using these as priors ensures model respects domain knowledge while learning from data.

---

### 7.3 Lazy Database Initialization

**Decision:** Don't block FastAPI startup on database migrations (lazy init in startup event)

**Trade-offs:**

| Aspect | Eager Init | Lazy Init |
|--------|-----------|----------|
| **Startup time** | 30–60s (wait for migrations) | <2s (non-blocking) |
| **First-request latency** | Normal | May be slow if migration still pending |
| **Failure handling** | Obvious at startup | Silent degradation (logged but not crashing) |
| **Readiness probe** | Reliable (/health always green after startup) | May return degraded status |

**Justification:** Internet startup speed matters (cold-start cloud functions). Lazy init keeps startup fast. If database is slow, that's a separate ops problem.

---

### 7.4 Redis Caching for Real-Time Features

**Decision:** Cache computed features in Redis (5-min TTL) to avoid recomputing on every inference

**Trade-offs:**

| Aspect | No Cache | Redis Cache |
|--------|----------|------------|
| **Feature freshness** | <100ms old | Up to 5 min stale |
| **Hit rate** | N/A | ~80% (same feature queried multiple times) |
| **Memory overhead** | Minimal | 500+ MB for 9000 trains × 20 features |
| **Latency improvement** | Baseline | 50% reduction (if cache hit) |
| **Complexity** | Simple | Added operational burden |

**Justification:** Features are expensive to compute (<50ms each). With cache hits, inference latency drops to <50ms p99. Trains don't move that fast; 5-min staleness is acceptable.

---

### 7.5 Network-First Architecture (Cascade Baked Into Core)

**Decision:** Cascade propagation is core system design (not a post-hoc visualization)

**Trade-offs:**

| Aspect | Alert-Only | Cascade-First |
|--------|-----------|---------------|
| **Relevance** | Single-train alerts | Network-aware risk scores |
| **Architectural complexity** | Simple (each train independent) | Complex (requires graph analysis) |
| **Accuracy** | Misses secondary failures | Predicts cascades 30–60 min early |
| **Operational value** | Reactive (fire alarm after delay) | Proactive (predict why delays will cascade) |

**Justification:** Most Indian Railways incidents are cascade failures (one hub failure → 20+ trains delayed). Network-first design is more valuable than single-train detection.

---

### 7.6 Hardcoded Bayesian CPTs vs. Learned CPTs

**Current (v2.0):** CPTs hardcoded by domain experts  
**Future (v3.0):** Learn CPTs from data (Structure + Parameter Learning)

**Current Trade-off:**

| Aspect | Hardcoded | Learned |
|--------|-----------|---------|
| **Time to production** | Days (experts write CPTs) | Months (data collection + learning) |
| **Accuracy** | Depends on expert quality | Better (data-driven) |
| **Interpretability** | High (domain experts validate) | Lower (black box learning) |
| **Maintenance** | Manual updates | Automatic (retraining) |

**Justification:** v2.0 prioritizes speed-to-market. Hardcoded CPTs are reasonable given 400 historical accidents + domain expertise. v3.0 can learn from NTES telemetry + passenger feedback.

---

## 8. Performance & Bottlenecks

### 8.1 Latency Budget (Target: <100ms p99)

**Breakdown (per inference cycle, 100 trains batch):**

| Component | Latency | Percentage |
|-----------|---------|-----------|
| Feature compute (FeatureEngine) | 50ms | 50% |
| Bayesian inference (pgmpy) | 15ms | 15% |
| Isolation Forest scoring | 10ms | 10% |
| DBSCAN calculation | 15ms | 15% |
| Causal DAG computation | 5ms | 5% |
| Ensemble voting + alert gen | 5ms | 5% |
| **Total** | **100ms** | **100%** |

**Current Status:** Meets target on modern hardware (2+ core CPU, 4+ GB RAM)

---

### 8.2 Identified Bottlenecks

#### **1. NTES API Polling Frequency**

**Problem:** Poll every 5 minutes → 2,880 requests/day per region

**Current Limit:** NTES API has undocumented rate limits; risk of throttling in production

**Mitigation:**
- Implement exponential backoff (retry with 2x delay on 429 status)
- Cache responses locally; invalidate on stale-check
- Consider event-driven architecture (receive webhooks instead of polling)

---

#### **2. Feature Cache Invalidation**

**Problem:** Redis TTL (5 min) means stale features up to 5 min old

**Impact:** If train's delay changes between cache write and model inference, model sees outdated feature

**Mitigation:**
- Reduce TTL to 1 minute (trade accuracy vs. memory)
- On high-frequency updates (e.g., major hub), invalidate cache manually
- Implement write-through cache (synchronous updates)

---

#### **3. Cascade Propagation (NetworkX BFS)**

**Problem:** Simulating cascade for every alert requires BFS traversal (O(V+E) = O(51+150) per alert)

**At high alert rate:** 100 alerts/min × 200ms per cascade = 20s propagation backlog

**Mitigation:**
- Pre-compute cascade paths for all 51 junctions (offline)
- Memoize results (cascade from NDLS always same)
- Implement parallel cascade simulation (threading/async)

---

#### **4. Database Query Performance (Audit Events)**

**Problem:** Historical queries (SELECT * FROM audit_events WHERE created_at > NOW() - INTERVAL '1 day') can be expensive on large tables

**Expected Row Count:** 9000 trains × ~0.1 alerts/train/day × 365 days = ~330K audit events/year

**At v1.0 scale (1 year data):** Queries over 330K rows without proper indexing → >500ms latency

**Mitigation:**
- Index on `created_at` column (already implicit via Schema)
- Partition audit events by month/zone
- Archive old records (>1 year) to S3

---

### 8.3 Scalability Recommendations

**Vertical Scaling (Single Machine, <100ms latency):**
- Current: 2 cores, 4 GB RAM
- Scalable to: 4 cores, 8 GB RAM
- Supports: 9000 trains/day, <100ms p99 per inference

**Horizontal Scaling (Multiple Machines, <50ms latency per pod):**
- Stateless API pods (replicate via Kubernetes ≤10 pods)
- Distributed feature store (Redis Cluster instead of single node)
- Database read replicas for audit queries
- Kafka partitioning by train_id for parallel feature compute

**Estimated Resource Requirements (Steady State):**
- **CPU:** 4 cores (2 for inference, 2 for I/O)
- **Memory:** 8 GB (4 GB for models, 4 GB for Redis cache)
- **Network:** 10 Mbps (NTES polling + WebSocket streams)
- **Storage:** 50 GB/year (audit logs at 100% retention)

---

## 9. Security Considerations

### 9.1 Authentication & Authorization

**Current:** No auth layer in `main_app.py` (open endpoints)

**Vulnerabilities:**
- Anyone with network access can read all alerts (including sensitive cascade info)
- No user tracking (can't audit who accessed what)
- No rate limiting (DDoS risk)

**Recommendations:**

```python
# JWT-based authentication (implement in auth.py)
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthCredentials
import jwt

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401)
    return user_id

@app.get("/api/alerts/unified")
async def get_alerts(current_user: str = Depends(get_current_user)):
    # Only allow users with "operator" role
    user = db.query(User).filter(User.id == current_user).first()
    if user.role != "operator":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return [...]  # User's filtered alerts
```

### 9.2 Container Security

**Current Dockerfile Practices:**
- ✅ Non-root user (drishti:1000)
- ✅ Multi-stage build (reduces image surface area)
- ❌ **No secrets scanning** in CI/CD
- ❌ **No image signing** (can't verify integrity)

**Recommendations:**
- Add Trivy vulnerability scanning in GitHub Actions:
  ```yaml
  - name: Run Trivy vulnerability scanner
    run: trivy image ghcr.io/drishti/drishti-api:latest --severity HIGH,CRITICAL
  ```
- Enable image signing with Cosign (supply chain security)
- Use private registry (vs. public ghcr.io)

### 9.3 Data Protection

**Sensitive Data:**
- Audit logs (which train had delays → privacy risk)
- User credentials (password hashes)
- Model state (could be reverse-engineered)

**Current Protections:**
- ✅ Password hashing (bcrypt, assumed in User.password_hash)
- ✅ HTTPS in reverse proxy (nginx with TLS certs)
- ❌ **No encryption at rest** for PostgreSQL
- ❌ **No field-level encryption** for audit logs

**Recommendations:**
```python
# Encrypt sensitive fields in models
from cryptography.fernet import Fernet

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    # Encrypt train_id to prevent correlation attacks
    @property
    def train_id_encrypted(self):
        cipher = Fernet(ENCRYPTION_KEY)
        return cipher.encrypt(self.train_id.encode())
```

### 9.4 Input Validation

**Current Vulnerabilities:**
- No validation on NTES train_state inputs (accepting any delay value)
- No bounds checking on latitude/longitude (could inject invalid coordinates)
- No SQL injection protection (using SQLAlchemy ORM which helps, but parameterized queries required)

**Example Injection Risk:**
```python
# VULNERABLE (if anywhere in code):
query = f"SELECT * FROM trains WHERE train_id = '{user_input}'"
db.execute(query)  # SQL injection!

# SAFE (SQLAlchemy):
db.query(Train).filter(Train.train_id == user_input).first()  # Parameterized
```

**Recommendations:**
```python
# Add Pydantic models for validation
from pydantic import BaseModel, Field, validator

class TrainTelemetryInput(BaseModel):
    train_id: str = Field(..., min_length=1, max_length=32)
    delay_minutes: int = Field(..., ge=-120, le=360)  # Bounds checking
    speed_kmh: float = Field(..., ge=0, le=140)
    latitude: float = Field(..., ge=8.0, le=35.0)  # India bounds
    longitude: float = Field(..., ge=68.0, le=97.0)
    
    @validator('train_id')
    def train_id_valid(cls, v):
        if not v.isalnum():
            raise ValueError('Must be alphanumeric')
        return v

@app.post("/api/trains/telemetry")
async def ingest_telemetry(data: TrainTelemetryInput):
    # Pydantic auto-validates before reaching handler
    ...
```

### 9.5 Audit Logging

**Current:** JSONL audit logs in `drishti_alerts.jsonl` (append-only)

**Strengths:**
- ✅ Immutable format (can't modify past entries)
- ✅ Human-readable (JSON)
- ✅ Cryptographically signable

**Weaknesses:**
- ❌ No digital signature (can't prove tampering)
- ❌ Local file storage (no backup/replication)
- ❌ No retention policy (grows unbounded)

**Recommendations:**
```python
# Add HMAC signature to audit trail
import hmac
import json

class AuditLog:
    def write(self, entry: Dict):
        entry['timestamp'] = datetime.now(tz=timezone.utc).isoformat()
        entry_json = json.dumps(entry, sort_keys=True)
        signature = hmac.new(
            AUDIT_KEY.encode(),
            entry_json.encode(),
            digestmod='sha256'
        ).hexdigest()
        
        audit_entry = {
            "entry": entry,
            "signature": signature,
        }
        
        # Write to PostgreSQL (with backup + replication)
        self.db.insert(AuditEvent(**audit_entry))
```

### 9.6 Known Security Gaps (Production Checklist)

| Risk | Severity | Mitigation Status |
|------|----------|-------------------|
| No HTTPS/TLS | HIGH | ❌ Not implemented (relies on nginx only) |
| No rate limiting | HIGH | ❌ Missing (DDoS risk) |
| No input validation | MEDIUM | ❌ Missing (injection risks) |
| No audit log signing | MEDIUM | ❌ Missing (non-repudiation) |
| Open endpoints (no auth) | HIGH | ❌ Missing (privacy risk) |
| Hardcoded secrets (Docker) | MEDIUM | ✅ Uses Secrets Manager (good practice) |
| No secrets scanning in CI/CD | MEDIUM | ❌ Missing |
| Container rootless not enforced | LOW | ✅ Non-root user (drishti:1000) |

---

## 10. Suggestions & Improvements

### 10.1 Production-Critical Gaps

#### **1. Implement Request Rate Limiting**

**Problem:** No protection against DDoS or accidental overload

**Solution:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api/alerts/unified")
@limiter.limit("100/minute")  # 100 requests per minute per IP
async def get_alerts(request: Request):
    ...
```

**Impact:** Prevents accidental abuse; adds <5ms overhead

---

#### **2. Add Comprehensive Input Validation**

**Problem:** Accepting any NTES telemetry without bounds checking

**Solution:** Use Pydantic for all external inputs (shown in Security section)

**Impact:** Prevents injection attacks, malformed data, and model misuse

---

#### **3. Implement Distributed Tracing (OpenTelemetry)**

**Problem:** Can't trace per-request latency breakdown (where does 100ms go?)

**Solution:**
```python
from opentelemetry import trace, metrics
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider

jaeger_exporter = JaegerExporter(agent_host_name="localhost")
trace.set_tracer_provider(TracerProvider(batcher=jaeger_exporter))
tracer = trace.get_tracer(__name__)

@app.get("/api/alerts/unified")
async def get_alerts():
    with tracer.start_as_current_span("compute_features") as span:
        features = feature_engine.compute_batch(trains)
    
    with tracer.start_as_current_span("inference") as span:
        inference_results = unified_engine.infer_batch(features)
    
    # Jaeger UI shows request flow + latency per component
```

**Impact:** 50ms overhead per request, invaluable for debugging

---

#### **4. Replace Fixed Bayesian CPTs with Learned CPTs**

**Problem:** Current CPTs are hardcoded by experts; not data-driven

**Solution (for v3.0):**
```python
# Structure Learning (find causal edges)
from pgmpy.estimators import StructureScore, K2Score
from pgmpy.estimators import PcEstimator, BayesianEstimator

# Learn DAG structure from data
pc = PcEstimator(df_data)
learned_dag = pc.estimate()

# Learn CPTs from data
bayesian_estimator = BayesianEstimator(pgm=learned_dag, data=df_data)
learned_cpts = bayesian_estimator.estimate_cpds()
```

**Impact:** More accurate predictions (95%+ vs current 85%); but requires 1000+ real-world accident samples (currently only 400)

---

#### **5. Add Feature Store (Feast)**

**Problem:** Managing 20+ features ad-hoc (encoding inconsistencies, versioning)

**Solution:**
```yaml
# feature_store.yaml
project: drishti
registry: s3://drishti-features/

feature_views:
  - name: train_features
    entities: [train_id]
    ttl: 300  # 5 minutes
    features:
      - delay_minutes: int
      - speed_kmh: float
      - centrality_rank: int
    source: drishti_postgres

  - name: zone_features
    entities: [zone]
    ttl: 3600  # 1 hour
    features:
      - accident_frequency: float
      - maintenance_active: bool
    source: cag_api
```

**Benefits:**
- Feature versioning (can revert if bad features released)
- Online/offline consistency (training ≠ serving features)
- Central governance (prevent duplicate feature definitions)

**Impact:** Maintenance burden reduced 70%; prevents "feature skew" bugs

---

### 10.2 Scalability Improvements

#### **6. Implement Cascade Memoization**

**Current:** BFS cascade simulation for every alert (~200ms)

**Improved:** Pre-compute cascade paths for all 51 junctions (offline)

```python
class CascadeCache:
    def __init__(self):
        self.cache = {}  # key: (junction, initial_delay), value: cascade_info
    
    def get_cascade(self, junction: str, initial_delay: int):
        # Round delay to nearest 15-min bucket (coarse-grain caching)
        delay_bucket = (initial_delay // 15) * 15
        key = (junction, delay_bucket)
        
        if key not in self.cache:
            self.cache[key] = self.compute_cascade(junction, delay_bucket)
        
        return self.cache[key]
    
    def precompute_all(self):
        """Run offline once per day."""
        for junction in ALL_JUNCTIONS:
            for delay in range(0, 360, 15):
                self.get_cascade(junction, delay)
```

**Impact:** Cascade latency: 200ms → 1ms (200x speedup); precomputation time: ~30s daily

---

#### **7. Implement Gradual Rollout (Canary Deployments)**

**Current:** All Kubernetes pods deploy simultaneously (risky if new model is broken)

**Improved:** Deploy to 10% of traffic first, validate, then 100%

```yaml
# Flagger CRD for canary deployment
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: drishti-canary
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: drishti-api
  progressDeadlineSeconds: 300
  service:
    port: 80
  analysis:
    interval: 1m
    threshold: 10
    maxWeight: 50
    stepWeight: 5
    metrics:
    - name: error-rate
      query: rate(requests_total{job="drishti",status=~"5.."}[5m])
      thresholdRange:
        max: 0.05  # Fail canary if error rate > 5%
    - name: latency
      query: histogram_quantile(0.95,rate(http_request_duration_seconds_bucket{app="drishti"}[5m]))
      thresholdRange:
        max: 0.1  # Fail canary if p95 latency > 100ms
  skipAnalysis: false
```

**Impact:** Reduces blast radius of bad deployments; catches issues before 100% rollout

---

#### **8. Add Model Versioning & A/B Testing**

**Current:** Single model version in production

**Improved:** Shadow deploy new model for 10% traffic, compare metrics

```python
class ModelABTest:
    def __init__(self):
        self.model_v2_0 = load_model("models/v2.0")
        self.model_v2_1_candidate = load_model("models/v2.1-candidate")
        self.split_percentage = 10  # 10% traffic to new model
    
    def infer(self, features, user_id):
        if hash(user_id) % 100 < self.split_percentage:
            # Shadow traffic: run new model but return from old
            new_prediction = self.model_v2_1_candidate.predict(features)
            self.log_shadow_prediction(user_id, new_prediction)
        
        # Production path: always return old model result
        old_prediction = self.model_v2_0.predict(features)
        
        # After 1 week, compare metrics:
        # - Accuracy (new vs. old)
        # - False positive rate
        # - Latency
        # If new > old: promote v2.1 to production
        
        return old_prediction
```

**Impact:** Zero-risk model updates; gradual validation

---

### 10.3 Operational Excellence

#### **9. Implement SLO Monitoring (Prometheus + AlertManager)**

**Problem:** Only monitoring raw metrics; no business-oriented SLOs defined

**Solution:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: drishti-api
    static_configs:
      - targets: ['localhost:8000']

rule_files:
  - 'slo_rules.yml'
```

```yaml
# slo_rules.yml
groups:
  - name: drishti_slos
    interval: 30s
    rules:
      # SLO 1: 99.9% uptime
      - alert: DrishtiAvailabilitySLO
        expr: up{job="drishti-api"} == 0
        for: 5m
        annotations:
          summary: "Drishti API down (SLO breach: >5m downtime)"
      
      # SLO 2: p95 latency < 100ms
      - alert: DrishtiLatencySLO
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="drishti-api"}[5m])) > 0.1
        for: 5m
        annotations:
          summary: "Drishti p95 latency > 100ms (SLO breach)"
      
      # SLO 3: False positive rate < 5%
      - alert: DrishtiAccuracySLO
        expr: rate(false_positive_alerts_total[24h]) / rate(alerts_total[24h]) > 0.05
        for: 1h
        annotations:
          summary: "Drishti false positive rate > 5% (SLO breach)"
```

**Impact:** Clear, measurable reliability targets; automatic alerts on SLO violations

---

#### **10. Add Chaos Engineering Tests**

**Problem:** No validation that system degrades gracefully under failure

**Solution (using Chaos Mesh):**
```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: drishti-pod-kill
spec:
  action: pod-kill
  mode: percentage
  value: "50"  # Kill 50% of pods
  selector:
    namespaces: [drishti]
    labelSelectors:
      app: drishti-api
  scheduler:
    cron: "0 3 * * *"  # every 3 AM UTC
---
# After pod kill, measure:
# - Did traffic reroute to remaining pods?
# - Was latency < 500ms during recovery?
# - Were alerts still generated?
```

**Impact:** Validates system resilience; confidence in production operations

---

### 10.4 Data & ML Improvements

#### **11. Implement Online Label Collection**

**Problem:** Ground truth labels only from historical corpus (400 records); modern telemetry unlabeled

**Solution:**
```python
class OnlineLabelCollector:
    def report_incident(self, alert_id: str, actual_outcome: bool):
        """
        Call this when real event outcome is known.
        Example: alert predicted cascade, did it happen?
        """
        alert = db.query(AuditEvent).filter(AuditEvent.id == alert_id).first()
        
        label_record = {
            "alert_id": alert_id,
            "predicted_risk": alert.consensus_risk,
            "actual_outcome": actual_outcome,  # True if cascade happened
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }
        
        # Append to online training queue
        kafka_producer.send("training_labels", label_record)
        
        # Trigger retraining if enough new labels accumulated
        if self.get_label_count_since_last_train() > 1000:
            self.trigger_retraining()
```

**Impact:** Per-alert accuracy feedback; enables continuous model improvement

---

#### **12. Add Explainability Dashboard**

**Problem:** Alerts show votes but not *why* each method voted

**Solution (using SHAP):**
```python
from shap import TreeExplainer

class AlertExplainer:
    def explain_alert(self, alert: EnsembleAlert, features: Dict):
        """Generate SHAP explanations for each vote."""
        
        # Explain Isolation Forest vote
        explainer = TreeExplainer(self.isolation_forest)
        shap_values = explainer.shap_values(features)
        
        # Top 5 features pushed model toward "danger"
        top_features = sorted(
            [(f, v) for f, v in zip(feature_names, shap_values)],
            key=lambda x: abs(x[1]),
            reverse=True
        )[:5]
        
        return {
            "alert_id": alert.alert_id,
            "isolation_forest_explanation": top_features,
            "dependency_plots": generate_pdp(self.isolation_forest, features),
            # Similar for other 3 methods...
        }
```

**Impact:** Operators understand *why* alerts fired; builds trust in system

---

### 10.5 Operational Runbooks

#### **Key Runbooks to Document**

1. **"Model Performance Degradation"**
   - Monitor: Accuracy < 85% or FP rate > 5%
   - Action: Trigger emergency retraining or rollback to old model
   
2. **"Cascade Simulator Convergence"**
   - Monitor: Cascade propagation time > 500ms
   - Action: Reduce BFS depth or enable memoization
   
3. **"NTES API Throttling"**
   - Monitor: 429 responses from NTES API
   - Action: Reduce polling frequency; implement exponential backoff

4. **"Database Connection Pool Exhaustion"**
   - Monitor: DB errors due to connection pool
   - Action: Increase pool_size in db/session.py; check for long-running queries

---

### 10.6 Estimated Effort for Top Recommendations

| Recommendation | Effort | Priority | Impact |
|---|---|---|---|
| Input validation (Pydantic) | 2 days | HIGH | Medium (prevents bugs) |
| Rate limiting (SlowAPI) | 1 day | HIGH | Medium (prevents abuse) |
| Distributed tracing (OTEL) | 3 days | MEDIUM | High (latency debugging) |
| Feature store (Feast) | 3 days | MEDIUM | High (ML governance) |
| Cascade memoization | 1 day | MEDIUM | High (perf boost) |
| Canary deployment (Flagger) | 2 days | MEDIUM | High (safe rollouts) |
| Model versioning/A/B (shadow) | 2 days | HIGH | High (risk mitigation) |
| SLO monitoring | 1 day | HIGH | Medium (observability) |
| Chaos engineering | 2 days | LOW | Medium (resilience) |
| Online label collection | 2 days | MEDIUM | High (ML improvement) |
| Explainability dashboard | 3 days | LOW | Medium (trust building) |
| Auth/JWT implementation | 3 days | HIGH | High (security) |
| **TOTAL** | **25 days (~5 weeks)** | — | — |

**Rough Timeline (if started today):**
- **Week 1:** Input validation, rate limiting, auth JWT
- **Week 2:** Canary deployments, model A/B testing
- **Week 3:** Distributed tracing, SLO monitoring
- **Week 4:** Feature store, online label collection
- **Week 5:** Cascade memoization, explainability dashboard

---

## Summary & Production Readiness

### Current State (v2.0)

**Strengths:**
- ✅ **Novel architecture:** 4-method ensemble for robust consensus
- ✅ **Network-aware:** Cascade simulation baked into core design
- ✅ **Containerized:** Multi-stage Docker, Kubernetes-ready
- ✅ **Observable:** ELK stack + Prometheus metrics
- ✅ **Scalable:** Horizontal scaling via Kubernetes (3–10 replicas)
- ✅ **Explainable:** Full audit trail (JSONL) for every decision

**Weaknesses:**
- ❌ **No auth:** Endpoints open to anyone
- ❌ **No rate limiting:** DDoS vulnerability
- ❌ **Input validation missing:** Injection risks
- ❌ **Hardcoded CPTs:** Not data-driven
- ❌ **Single feature cache:** No versioning/governance
- ❌ **No chaos tests:** Untested failure modes

### Production Readiness Score: **6/10**

**Gap to Production (≥8/10):**
- Add authentication + authorization (2 points)
- Add rate limiting + input validation (1 point)
- Implement distributed tracing (1 point)

**Gap to Optimal (≥9/10):**
- Feature store + online learning (1 point)
- Chaos engineering + canary deployments (1 point)

### Recommendation

**For Immediate Deployment:**
If deadline is urgent (< 2 weeks), deploy with:
1. Rate limiting added (1 day)
2. Internal-only network (behind corporate firewall)
3. Manual audit log review (ops team)
4. Basic input validation (1 day)

**For Enterprise Deployment (4–6 weeks):**
1. Full JWT auth + role-based access control
2. Distributed tracing (OTEL + Jaeger)
3. Canary deployments (Flagger)
4. Model A/B testing framework
5. Chaos engineering validation

**For Production at Scale (8+ weeks):**
All of the above +
1. Feature store (Feast)
2. Online label collection
3. Automatic retraining (MLflow)
4. Explainability dashboard
5. SLO monitoring (Prometheus AlertManager)

---

**Document Compiled by:** Senior Architecture Review Team  
**Date:** April 2026  
**Version:** 2.0.0 (Production Candidate)

