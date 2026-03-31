import json
import os
import random
import time
from typing import Dict, List

class CascadeEngine:
    """
    DRISHTI Layer 2 & 3: Operations Pulse & Cascade Predictor.
    Loads the Layer 1 structure and simulates live NTES delays traversing it.
    """
    def __init__(self):
        self.graph_data = {}
        self.nodes = {}
        self.edges = []
        self.zone_health = {}
        
        self.load_graph()
        self.initialize_state()
        
    def load_graph(self):
        graph_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "network_graph.json")
        try:
            with open(graph_path, "r") as f:
                payload = json.load(f)
                self.graph_data = payload.get("graph", {})
                
            for node in self.graph_data.get("nodes", []):
                self.nodes[node["id"]] = {
                    "data": node,
                    "delay_minutes": 0,
                    "stress_level": "LOW",  # LOW, MEDIUM, HIGH, CRITICAL
                    "cascade_risk": 0.0     # 0 to 1 likelihood of spreading
                }
                
            self.edges = self.graph_data.get("links", [])
            print(f"CascadeEngine Initialized: Loaded {len(self.nodes)} nodes, {len(self.edges)} edges.")
        except Exception as e:
            print(f"Warning: Failed to load network graph. Ensure graph_builder.py ran first. Error: {e}")
            
    def initialize_state(self):
        # Zones
        zones = set()
        for node in self.nodes.values():
            if "zone" in node["data"]:
                zones.add(node["data"]["zone"])
                
        for z in zones:
            self.zone_health[z] = {"score": 100, "status": "HEALTHY", "delayed_hubs": 0}
            
    def step_simulation(self):
        """
        Advances the network state by 1 step. 
        Simulates live NTES feed + cascade propagation.
        """
        if not self.nodes: return
        
        # 1. Random "NTES" Delay Injections (Bias towards high centrality)
        # We only inject raw delays into top tier nodes to test the propagation visually
        target = random.choice(list(self.nodes.values()))
        centrality = target["data"].get("centrality", 0.0)
        
        # High centrality nodes get hit harder
        if random.random() < (centrality + 0.1): 
            spike = random.randint(15, 60)
            target["delay_minutes"] = min(target["delay_minutes"] + spike, 300)
            
        # 2. Propagation (The network cascade math)
        next_delays = {k: v["delay_minutes"] for k, v in self.nodes.items()}
        
        # Decay (Network healing naturally over time if no cascades hitting it)
        for nid in next_delays:
            if next_delays[nid] > 0:
                next_delays[nid] = max(0, next_delays[nid] - random.randint(1, 5))
                
        # Cascade spread
        for edge in self.edges:
            src = edge["source"]
            tgt = edge["target"]
            # Treat as undirected for cascade (delays ripple both ways over hours)
            for u, v in [(src, tgt), (tgt, src)]:
                if u in self.nodes and v in self.nodes:
                    delay_u = self.nodes[u]["delay_minutes"]
                    # If heavily delayed, it bleeds over into the connected node
                    if delay_u > 45: 
                        spread = int(delay_u * 0.1) # 10% bleeds over per cycle
                        next_delays[v] += spread
                        
        # 3. Apply state and calculate risks & health
        zone_aggregates = {z: 0 for z in self.zone_health}
        zone_counts = {z: 0 for z in self.zone_health}
        
        for nid, node in self.nodes.items():
            delay = min(next_delays[nid], 300)
            node["delay_minutes"] = delay
            
            # Severity thresholds
            if delay < 30:
                node["stress_level"] = "LOW"
            elif delay < 60:
                node["stress_level"] = "MEDIUM"
            elif delay < 120:
                node["stress_level"] = "HIGH"
            else:
                node["stress_level"] = "CRITICAL"
                
            # Cascade Risk = Centrality * Delay severity
            c_score = node["data"].get("centrality", 0)
            node["cascade_risk"] = round(min((delay / 60.0) * c_score * 2, 1.0), 3)
            
            z = node["data"].get("zone")
            if z in zone_aggregates:
                zone_aggregates[z] += delay
                zone_counts[z] += 1
                if delay > 60:
                    self.zone_health[z]["delayed_hubs"] += 1
                    
        # Update Zone Health
        for z in self.zone_health:
            if zone_counts[z] > 0:
                avg_delay = zone_aggregates[z] / zone_counts[z]
                score = max(0, 100 - avg_delay)
                self.zone_health[z]["score"] = round(score, 1)
                
                if score > 80: self.zone_health[z]["status"] = "HEALTHY"
                elif score > 50: self.zone_health[z]["status"] = "STRESSED"
                else: self.zone_health[z]["status"] = "CRITICAL"
                self.zone_health[z]["delayed_hubs"] = sum(1 for n in self.nodes.values() if n["data"].get("zone") == z and n["stress_level"] in ["HIGH", "CRITICAL"])

    def get_state(self) -> Dict:
        """Returns the current network intelligence pulse."""
        return {
            "timestamp": time.time(),
            "nodes": [
                {
                    "id": k,
                    "name": v["data"]["name"],
                    "zone": v["data"]["zone"],
                    "centrality": round(v["data"].get("centrality", 0), 4),
                    "lat": v["data"]["lat"],
                    "lng": v["data"]["lng"],
                    "delay_minutes": v["delay_minutes"],
                    "stress_level": v["stress_level"],
                    "cascade_risk": v["cascade_risk"]
                }
                for k, v in self.nodes.items()
            ],
            "zone_health": self.zone_health
        }
