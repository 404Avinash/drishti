import { useState, useEffect } from 'react'
import { getInferenceHealth, getInferenceModels, predictSingle, getCurrentTrains } from '../api'

export default function Inference() {
  const [inferenceHealth, setInferenceHealth] = useState(null)
  const [models, setModels] = useState(null)
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [trains, setTrains] = useState([])
  const [selectedTrain, setSelectedTrain] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Load inference status
        const [health, modelData, trainsData] = await Promise.all([
          getInferenceHealth(),
          getInferenceModels(),
          getCurrentTrains(),
        ])
        
        setInferenceHealth(health)
        setModels(modelData)
        setTrains(trainsData || [])
        
        // Select first train by default
        if (trainsData && trainsData.length > 0) {
          setSelectedTrain(trainsData[0])
        }
      } catch (err) {
        console.error('[Inference] Load error:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
    const iv = setInterval(loadData, 10000) // Refresh every 10s
    return () => clearInterval(iv)
  }, [])

  const handlePredict = async (train) => {
    if (!train) return
    
    try {
      // Generate mock feature data (576x15) for demo
      const features = Array(576).fill(0).map(() => 
        Array(15).fill(0).map(() => Math.random() * 100)
      )
      
      // Mock traditional inputs (should come from actual data)
      const traditionalInputs = {
        bayesian_risk: Math.random(),
        anomaly_score: Math.random() * 100,
        dbscan_anomaly: Math.random() > 0.7,
        causal_risk: Math.random(),
      }
      
      const result = await predictSingle(train.train_id, features, traditionalInputs)
      setPredictions(prev => ({
        ...prev,
        [train.train_id]: result,
      }))
    } catch (err) {
      console.error('[Predict] Error:', err)
    }
  }

  if (loading) {
    return <div style={S.page}>Loading inference engine...</div>
  }

  return (
    <div style={S.page}>
      <h1 style={S.title}>⬙ Inference Engine</h1>
      
      {/* Status Cards */}
      <div style={S.grid}>
        {/* Health Status */}
        <div style={{ ...S.card, borderLeft: `4px solid ${inferenceHealth?.status === 'healthy' ? '#0f0' : '#f00'}` }}>
          <h3>Engine Status</h3>
          <div style={S.big}>{inferenceHealth?.status || 'unknown'}</div>
          <div style={S.small}>{new Date(inferenceHealth?.timestamp).toLocaleTimeString()}</div>
        </div>
        
        {/* Models Loaded */}
        <div style={{ ...S.card, borderLeft: '4px solid #0ff' }}>
          <h3>Models Loaded</h3>
          <div style={S.big}>{models?.models_loaded ?? 0}</div>
          <div style={S.small}>{(models?.registered_models || []).join(', ') || 'None'}</div>
        </div>
        
        {/* Inference Metrics */}
        <div style={{ ...S.card, borderLeft: '4px solid #ff0' }}>
          <h3>Performance</h3>
          <div style={S.big}>
            {models?.inference_metrics?.avg_latency_ms?.toFixed(2) || 'N/A'} ms
          </div>
          <div style={S.small}>
            Success: {(models?.inference_metrics?.success_rate * 100).toFixed(1) || 'N/A'}%
          </div>
        </div>
      </div>

      {/* Prediction Interface */}
      <div style={S.section}>
        <h2>Real-Time Predictions</h2>
        
        {/* Train Selector */}
        <div style={S.selector}>
          <label>Select Train:</label>
          <select
            value={selectedTrain?.train_id || ''}
            onChange={(e) => {
              const train = trains.find(t => t.train_id === e.target.value)
              setSelectedTrain(train)
            }}
            style={S.input}
          >
            {trains.map(t => (
              <option key={t.train_id} value={t.train_id}>
                {t.train_name} ({t.train_id})
              </option>
            ))}
          </select>
          
          <button
            onClick={() => handlePredict(selectedTrain)}
            style={S.button}
          >
            Get Prediction
          </button>
        </div>

        {/* Predictions Display */}
        <div style={S.predictions}>
          {Object.entries(predictions).map(([trainId, pred]) => (
            <div key={trainId} style={{
              ...S.predCard,
              borderTop: `3px solid ${
                pred.severity === 'CRITICAL' ? '#f00' :
                pred.severity === 'HIGH' ? '#f80' :
                pred.severity === 'MEDIUM' ? '#ff0' : '#0f0'
              }`
            }}>
              <h3>{trainId}</h3>
              
              {/* Alert Status */}
              <div style={S.alertStatus}>
                <div style={{
                  ...S.badge,
                  backgroundColor: pred.alert_fires ? '#f00' : '#0f0'
                }}>
                  {pred.alert_fires ? '🚨 ALERT' : '✅ OK'}
                </div>
                <div style={{...S.badge, backgroundColor: '#0ff'}}>
                  {pred.severity}
                </div>
                <div style={{...S.badge, backgroundColor: '#f0f'}}>
                  Risk: {(pred.consensus_risk || 0).toFixed(1)}%
                </div>
              </div>

              {/* Voting Breakdown */}
              <div style={S.voting}>
                <h4>5-Method Voting ({pred.methods_agreeing || 0} agree)</h4>
                {pred.votes_breakdown?.map((vote, i) => (
                  <div key={i} style={S.vote}>
                    <strong>{vote.method}</strong>
                    <span style={{color: vote.votes_danger ? '#f00' : '#0f0'}}>
                      {vote.votes_danger ? '⚠️ DANGER' : '✓ OK'}
                    </span>
                    <span>Score: {(vote.score || 0).toFixed(2)}</span>
                  </div>
                )) || <div>No voting data</div>}
              </div>

              {/* Recommended Actions */}
              {pred.recommended_actions?.length > 0 && (
                <div style={S.actions}>
                  <h4>Recommended Actions</h4>
                  <ul>
                    {pred.recommended_actions.map((action, i) => (
                      <li key={i}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Performance Metrics */}
              <div style={S.metrics}>
                <div>Latency: {(pred.neural_latency_ms || 0).toFixed(2)}ms</div>
                <div>Neural Models: {Object.keys(pred.neural_predictions || {}).length}</div>
              </div>

              {/* Explanation */}
              {pred.explanation && (
                <div style={S.explanation}>
                  <strong>Explanation:</strong>
                  <p>{pred.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* All Trains Quick Prediction */}
      <div style={S.section}>
        <h2>Batch Predictions</h2>
        <button
          onClick={() => {
            trains.slice(0, 5).forEach(t => handlePredict(t))
          }}
          style={{...S.button, backgroundColor: '#0f0', color: '#000'}}
        >
          Predict Top 5 Trains
        </button>
      </div>
    </div>
  )
}

const S = {
  page: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2.5em',
    margin: '0 0 30px',
    color: '#0ff',
    textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    marginBottom: '30px',
  },
  card: {
    background: 'rgba(0, 20, 40, 0.7)',
    border: '1px solid rgba(0, 255, 255, 0.3)',
    borderRadius: '8px',
    padding: '15px',
    backdropFilter: 'blur(10px)',
  },
  big: {
    fontSize: '2em',
    fontWeight: 'bold',
    color: '#0ff',
    margin: '10px 0',
  },
  small: {
    fontSize: '0.9em',
    color: '#888',
  },
  section: {
    background: 'rgba(0, 20, 40, 0.5)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  selector: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid rgba(0, 255, 255, 0.3)',
    color: '#0ff',
    borderRadius: '4px',
  },
  button: {
    padding: '8px 16px',
    background: '#0f0',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9em',
  },
  predictions: {
    display: 'grid',
    gap: '15px',
  },
  predCard: {
    background: 'rgba(0, 10, 20, 0.9)',
    border: '1px solid rgba(0, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '15px',
  },
  alertStatus: {
    display: 'flex',
    gap: '10px',
    margin: '10px 0',
    flexWrap: 'wrap',
  },
  badge: {
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '0.9em',
    fontWeight: 'bold',
    color: '#000',
  },
  voting: {
    margin: '15px 0',
    padding: '10px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
  },
  vote: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    borderBottom: '1px solid rgba(0, 255, 255, 0.1)',
    fontSize: '0.9em',
  },
  actions: {
    margin: '15px 0',
    padding: '10px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
  },
  metrics: {
    display: 'flex',
    gap: '20px',
    margin: '10px 0',
    fontSize: '0.85em',
    color: '#888',
  },
  explanation: {
    margin: '15px 0',
    padding: '10px',
    background: 'rgba(0, 255, 255, 0.1)',
    borderRadius: '4px',
    borderLeft: '3px solid #0ff',
  },
}
