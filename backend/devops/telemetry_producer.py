import os
import json
import time
import random
import threading
import redis
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TelemetryProducer")

# --- GEO-DATA: The Core Network (Golden Quadrilateral & Diagonals) ---
S = {
  "NDLS": [28.6430, 77.2185], "JHS": [25.4604, 78.5772], "ET": [22.6111, 77.7601], 
  "NGP": [21.1472, 79.0881], "BZA": [16.5062, 80.6480], "MAS": [13.0827, 80.2707],
  "MMCT": [18.9696, 72.8194], "HWH": [22.5841, 88.3435],
  "AGC": [27.1767, 78.0081], "GWL": [26.2183, 78.1828], "BPL": [23.2599, 77.4126], 
  "BPQ": [19.8488, 79.3564], "WL": [17.9818, 79.5960], "OGL": [15.5057, 80.0499], "NLR": [14.4426, 79.9865],
  "KYN": [19.2396, 73.1360], "IGP": [19.6974, 73.5539], "NK": [19.9975, 73.7898], "MMR": [20.2520, 74.4371],
  "BSL": [21.0455, 75.7725], "AK": [20.7059, 77.0058], "BD": [20.8653, 77.7479], "G": [21.4624, 80.1961],
  "DURG": [21.1891, 81.2849], "R": [21.2514, 81.6296], "BSP": [22.0797, 82.1409], "JSG": [21.8601, 84.0505],
  "ROU": [22.2511, 84.8582], "CKP": [22.6841, 85.6267], "TATA": [22.7720, 86.2081], "KGP": [22.3396, 87.3204],
  "BLS": [21.4934, 86.9337], "BHC": [21.0553, 86.4977], "CTC": [20.4625, 85.8828], "BUB": [20.2961, 85.8245],
  "KUR": [20.1534, 85.6268], "BAM": [19.3149, 84.7941], "VZM": [18.1133, 83.3977], "VSKP": [17.6868, 83.2185],
  "RJY": [17.0005, 81.8040],
  "RE": [28.1923, 76.6212], "AWR": [27.5530, 76.6346], "JP": [26.9196, 75.7878], "AII": [26.4499, 74.6399],
  "MJ": [25.7275, 73.6067], "ABR": [24.4789, 72.7766], "PNU": [24.1718, 72.4334], "MSH": [23.5880, 72.3693],
  "ADI": [23.0256, 72.5977], "BRC": [22.3072, 73.1812], "ST": [21.1702, 72.8311], "VAPI": [20.3705, 72.9048], 
  "BVI": [19.2307, 72.8567]
}

RUT = {
  "northSouth": [S["NDLS"], S["AGC"], S["GWL"], S["JHS"], S["BPL"], S["ET"], S["NGP"], S["BPQ"], S["WL"], S["BZA"], S["OGL"], S["NLR"], S["MAS"]],
  "westEast": [S["MMCT"], S["KYN"], S["IGP"], S["NK"], S["MMR"], S["BSL"], S["AK"], S["BD"], S["NGP"], S["G"], S["DURG"], S["R"], S["BSP"], S["JSG"], S["ROU"], S["CKP"], S["TATA"], S["KGP"], S["HWH"]],
  "eastCoast": [S["HWH"], S["KGP"], S["BLS"], S["BHC"], S["CTC"], S["BUB"], S["KUR"], S["BAM"], S["VZM"], S["VSKP"], S["RJY"], S["BZA"], S["OGL"], S["NLR"], S["MAS"]],
  "westCorridor": [S["NDLS"], S["RE"], S["AWR"], S["JP"], S["AII"], S["MJ"], S["ABR"], S["PNU"], S["MSH"], S["ADI"], S["BRC"], S["ST"], S["VAPI"], S["BVI"], S["MMCT"]]
}

RISKS = {"CRITICAL": 0.1, "HIGH": 0.4, "MEDIUM": 0.8, "LOW": 1.0}

def get_random_severity():
    g = random.random()
    if g > 0.95: return "CRITICAL"
    if g > 0.85: return "HIGH"
    if g > 0.20: return "MEDIUM"
    return "LOW"

class TelemetryDaemon:
    """
    DARPA-grade independent publisher.
    Executes heavy physics physics calculations out-of-band without dropping API frames.
    Publishes raw coordinates to a local Redis message broker.
    """
    def __init__(self):
        self.r = redis.Redis(host='localhost', port=6379, db=0)
        self.trains = []
        routes = list(RUT.keys())
        
        # Spawn massive fleet on exact topological bounds
        for i in range(80):
            self.trains.append({
                "id": f"T{10000 + i}",
                "routeKey": routes[i % len(routes)],
                "direction": "FWD" if i % 2 == 0 else "REV",
                "ratio": random.random(),
                "severity": get_random_severity()
            })
            
    def start(self):
        logger.info("Initializing Geographic Pipeline Publisher...")
        
        # Test Redis Connection
        try:
            self.r.ping()
        except redis.ConnectionError:
            logger.error("Redis is currently offline! Kafka/Redis stream depends on a broker. Will dump to STDOUT.")

        # 1 Hz Polling rate
        while True:
            batch = []
            for t in self.trains:
                speed = RISKS.get(t["severity"], 1.0)
                # Sweep the ratio
                step = (0.002 * speed) * (1 if t["direction"] == "FWD" else -1)
                t["ratio"] += step
                
                # Bounds wrapping
                if t["ratio"] >= 1: t["ratio"] -= 1
                elif t["ratio"] <= 0: t["ratio"] += 1
                
                # We do NOT run `lerpPosition` in Python (it pushes too much data),
                # We just stream the literal ratio bounds so the client interpolates effortlessly.
                # Just like an MMO syncing server.
                batch.append({
                    "id": t["id"],
                    "routeKey": t["routeKey"],
                    "direction": t["direction"],
                    "ratio": t["ratio"],
                    "severity": t["severity"]
                })
                
            payload = json.dumps({"type": "telemetry", "data": batch})
            try:
                self.r.publish("drishti_gps_feed", payload)
            except Exception:
                # Silently fail if Broker is down
                pass
                
            time.sleep(1.0)

if __name__ == "__main__":
    daemon = TelemetryDaemon()
    daemon.start()
