import React, { useState, useEffect } from 'react';
import './Simulation.css';

export default function Simulation() {
  // Simulation state
  const [scenario, setScenario] = useState(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [timeStep, setTimeStep] = useState(0);
  const [trainPositions, setTrainPositions] = useState({});
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState({
    nodeStress: {},
    conflictDetected: false,
    collisionRisk: false,
    interventionActive: false
  });

  // Mini network definition
  const network = {
    nodes: {
      A: { x: 50, y: 250, name: 'Station A', centrality: 0.3 },
      B: { x: 200, y: 250, name: 'Station B', centrality: 0.5 },
      C: { x: 350, y: 250, name: 'Junction C (Critical)', centrality: 0.9 },
      D: { x: 500, y: 250, name: 'Station D', centrality: 0.4 },
      L: { x: 350, y: 400, name: 'Loop Line L', centrality: 0.2 }
    },
    edges: [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
      { from: 'C', to: 'L' }
    ]
  };

  // Initialize trains
  const initializeTrains = () => {
    return {
      coromandel: { position: 'A', speed: 2, status: 'moving', color: '#FF6B6B' },
      goods: { position: 'L', speed: 0, status: 'parked', color: '#4ECDC4' }
    };
  };

  // Simulate Case 1: Without DRISHTI
  const simulateWithoutDRISHTI = () => {
    setScenario('without-drishti');
    setSimulationRunning(true);
    setTimeStep(0);
    setTrainPositions(initializeTrains());
    setEvents([
      { time: 0, message: '🚂 Coromandel Express leaving Station A', type: 'info' },
      { time: 5, message: '⚠️ Signal Error: Route changed to Loop Line', type: 'warning' },
      { time: 8, message: '🔴 Collision Risk: Goods train on Loop Line', type: 'error' },
      { time: 10, message: '💥 CRASH: Coromandel hits Goods train', type: 'critical' }
    ]);
    setMetrics({
      nodeStress: { C: 95, L: 85 },
      conflictDetected: false,
      collisionRisk: false,
      interventionActive: false
    });
  };

  // Simulate Case 2: With DRISHTI
  const simulateWithDRISHTI = () => {
    setScenario('with-drishti');
    setSimulationRunning(true);
    setTimeStep(0);
    setTrainPositions(initializeTrains());
    setEvents([
      { time: 0, message: '🚂 Coromandel Express leaving Station A', type: 'info' },
      { time: 3, message: '📊 DRISHTI: Monitoring Junction C stress (85%)', type: 'info' },
      { time: 4, message: '🔔 Node C stress HIGH - occupied track detected on Loop Line', type: 'warning' },
      { time: 5, message: '⚠️ Signal Error: Route changed to Loop Line', type: 'warning' },
      { time: 6, message: '🎯 DRISHTI ALERT: Collision risk in 4 seconds detected!', type: 'critical' },
      { time: 7, message: '✅ INTERVENTION: Hold train at Station B for 2 minutes', type: 'success' },
      { time: 10, message: '🟢 Goods train clears Loop Line', type: 'info' },
      { time: 12, message: '✅ Safe passage: Coromandel routed to main line via D', type: 'success' }
    ]);
    setMetrics({
      nodeStress: { C: 95, L: 85, B: 40 },
      conflictDetected: true,
      collisionRisk: true,
      interventionActive: true
    });
  };

  // Animate simulation
  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(() => {
      setTimeStep(prev => {
        const nextTime = prev + 1;
        
        if (scenario === 'without-drishti') {
          if (nextTime <= 10) {
            // Train moves toward loop line
            if (nextTime <= 5) {
              setTrainPositions(prev => ({
                ...prev,
                coromandel: { ...prev.coromandel, position: 'B' }
              }));
            } else if (nextTime <= 8) {
              setTrainPositions(prev => ({
                ...prev,
                coromandel: { ...prev.coromandel, position: 'L' }
              }));
            } else {
              setTrainPositions(prev => ({
                ...prev,
                coromandel: { ...prev.coromandel, status: 'crashed' }
              }));
              setSimulationRunning(false);
            }
          }
        } else if (scenario === 'with-drishti') {
          if (nextTime <= 12) {
            // Train holds at B, then proceeds safely
            if (nextTime <= 7) {
              setTrainPositions(prev => ({
                ...prev,
                coromandel: { ...prev.coromandel, position: 'B', status: 'held' }
              }));
            } else if (nextTime <= 12) {
              setTrainPositions(prev => ({
                ...prev,
                coromandel: { ...prev.coromandel, position: 'D', status: 'safe' }
              }));
            }
          } else {
            setSimulationRunning(false);
          }
        }

        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simulationRunning, scenario]);

  // Get train visual info
  const getTrainInfo = (train) => {
    if (train.status === 'crashed') return { symbol: '💥', color: '#000000' };
    if (train.status === 'held') return { symbol: '⏸️', color: '#FFA500' };
    if (train.status === 'safe') return { symbol: '✅', color: '#4ECDC4' };
    return { symbol: '🚂', color: train.color };
  };

  return (
    <div className="simulation-container">
      <div className="simulation-header">
        <h1>⚡ Railway Network Simulation</h1>
        <p>Balasore Accident Scenario: With & Without DRISHTI</p>
      </div>

      <div className="scenario-selector">
        <button
          className={`scenario-btn ${scenario === 'without-drishti' ? 'active' : ''}`}
          onClick={() => {
            if (!simulationRunning) {
              simulateWithoutDRISHTI();
            }
          }}
          disabled={simulationRunning}
        >
          ❌ Case 1: Without DRISHTI
        </button>
        <button
          className={`scenario-btn ${scenario === 'with-drishti' ? 'active' : ''}`}
          onClick={() => {
            if (!simulationRunning) {
              simulateWithDRISHTI();
            }
          }}
          disabled={simulationRunning}
        >
          ✅ Case 2: With DRISHTI
        </button>
        <button
          className="reset-btn"
          onClick={() => {
            setSimulationRunning(false);
            setScenario(null);
            setTimeStep(0);
            setTrainPositions({});
            setEvents([]);
          }}
        >
          🔄 Reset
        </button>
      </div>

      {scenario && (
        <div className="simulation-content">
          <div className="network-visualization">
            <svg width="600" height="500" className="network-svg">
              {/* Edges */}
              {network.edges.map((edge, idx) => {
                const from = network.nodes[edge.from];
                const to = network.nodes[edge.to];
                return (
                  <line
                    key={`edge-${idx}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="#666"
                    strokeWidth="2"
                  />
                );
              })}

              {/* Nodes */}
              {Object.entries(network.nodes).map(([id, node]) => {
                const stress = metrics.nodeStress[id] || 0;
                let nodeColor = '#4ECDC4';
                if (stress > 80) nodeColor = '#FF6B6B';
                else if (stress > 50) nodeColor = '#FFE66D';
                else if (stress > 20) nodeColor = '#95E1D3';

                return (
                  <g key={`node-${id}`}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="30"
                      fill={nodeColor}
                      stroke="#333"
                      strokeWidth="2"
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dy="0.3em"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {id}
                    </text>
                    {stress > 0 && (
                      <text
                        x={node.x}
                        y={node.y + 20}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#333"
                      >
                        {stress}%
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Trains */}
              {trainPositions.coromandel && network.nodes[trainPositions.coromandel.position] && (
                <g>
                  <text
                    x={network.nodes[trainPositions.coromandel.position].x}
                    y={network.nodes[trainPositions.coromandel.position].y - 50}
                    fontSize="24"
                    textAnchor="middle"
                  >
                    {getTrainInfo(trainPositions.coromandel).symbol}
                  </text>
                </g>
              )}

              {trainPositions.goods && network.nodes[trainPositions.goods.position] && (
                <g>
                  <text
                    x={network.nodes[trainPositions.goods.position].x + 50}
                    y={network.nodes[trainPositions.goods.position].y - 50}
                    fontSize="24"
                    textAnchor="middle"
                  >
                    🚂 (Goods)
                  </text>
                </g>
              )}
            </svg>
          </div>

          <div className="simulation-info">
            <div className="metrics-panel">
              <h3>📊 System Metrics</h3>
              <div className="metric">
                <span>Time: </span>
                <strong>{timeStep}s</strong>
              </div>
              <div className="metric">
                <span>Junction C Stress: </span>
                <strong className={metrics.nodeStress.C > 80 ? 'critical' : ''}>
                  {metrics.nodeStress.C || 0}%
                </strong>
              </div>
              <div className="metric">
                <span>Loop Line Stress: </span>
                <strong className={metrics.nodeStress.L > 80 ? 'critical' : ''}>
                  {metrics.nodeStress.L || 0}%
                </strong>
              </div>
              <div className="metric">
                <span>Conflict Detected: </span>
                <strong className={metrics.conflictDetected ? 'warning' : 'safe'}>
                  {metrics.conflictDetected ? '⚠️ YES' : '✅ NO'}
                </strong>
              </div>
              <div className="metric">
                <span>Collision Risk: </span>
                <strong className={metrics.collisionRisk ? 'critical' : 'safe'}>
                  {metrics.collisionRisk ? '🔴 HIGH' : '🟢 LOW'}
                </strong>
              </div>
              {scenario === 'with-drishti' && (
                <div className="metric">
                  <span>Intervention: </span>
                  <strong className={metrics.interventionActive ? 'success' : ''}>
                    {metrics.interventionActive ? '✅ ACTIVE' : 'Inactive'}
                  </strong>
                </div>
              )}
            </div>

            <div className="events-panel">
              <h3>📖 Event Timeline</h3>
              <div className="events-list">
                {events
                  .filter(e => e.time <= timeStep)
                  .map((event, idx) => (
                    <div key={idx} className={`event event-${event.type}`}>
                      <span className="event-time">[T+{event.time}s]</span>
                      <span className="event-msg">{event.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!scenario && (
        <div className="intro-panel">
          <div className="intro-content">
            <h2>🎯 Simulation Overview</h2>
            <p>
              This simulation demonstrates the Balasore train accident scenario from June 2, 2023.
            </p>
            
            <div className="scenario-description">
              <h3>📍 What Happened in Balasore</h3>
              <ul>
                <li>Coromandel Express got a green signal</li>
                <li>Wrongly diverted to loop line (signal error)</li>
                <li>Goods train already standing on loop line</li>
                <li>Head-on collision → 300+ dead, 1200+ injured</li>
              </ul>
            </div>

            <div className="scenario-description">
              <h3>❌ Case 1: Without DRISHTI</h3>
              <ul>
                <li>No network awareness</li>
                <li>No stress monitoring</li>
                <li>Signal error goes undetected</li>
                <li>Collision happens → catastrophic failure</li>
              </ul>
            </div>

            <div className="scenario-description">
              <h3>✅ Case 2: With DRISHTI</h3>
              <ul>
                <li>Network stress detected early (95% at Junction C)</li>
                <li>Loop line occupancy tracked</li>
                <li>Collision risk predicted in advance</li>
                <li>Intervention: Hold train at Station B for 2 minutes</li>
                <li>Goods train clears → Safe passage</li>
              </ul>
            </div>

            <p className="intro-footer">
              <strong>Key Insight:</strong> Accidents don't happen because of one error. They happen
              when systems are already in a fragile state. DRISHTI detects that fragility.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
