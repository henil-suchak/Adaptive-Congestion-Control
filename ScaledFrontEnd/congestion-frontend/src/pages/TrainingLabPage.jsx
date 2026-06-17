import { useState, useEffect, useRef, useCallback } from 'react';
import { ExperimentService, TrainingService } from '../services/api';
import { TopologyService } from '../services/topologyApi';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TrainingLabPage() {
  // ── Topology Config ──────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: 'My Training Run',
    topologyId: '',
  });
  const [topologies, setTopologies] = useState([]);

  // ── Training Hyperparameters ─────────────────────────────────
  const [hyperparams, setHyperparams] = useState({
    totalTimesteps: 500000,
    learningRate: 1e-4,
    networkArch: '256,256',
    rewardProfile: 'BALANCED',
  });

  // ── State ────────────────────────────────────────────────────
  const [status, setStatus] = useState('');
  const [experimentId, setExperimentId] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [trainingRuns, setTrainingRuns] = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [metricsData, setMetricsData] = useState([]);
  const stompRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Load training runs ────────────────────────────────────────
  const loadTrainingRuns = useCallback(async () => {
    try {
      const runs = await TrainingService.getTrainingRuns();
      setTrainingRuns(runs);
    } catch (e) {
      console.error('Failed to load training runs:', e);
    }
  }, []);

  // ── Load training runs on mount ──────────────────────────────
  // ── Load training runs on mount ──────────────────────────────
  useEffect(() => {
    loadTrainingRuns().catch(console.error);
  }, [loadTrainingRuns]);

  useEffect(() => {
    TopologyService.getAll().then(setTopologies).catch(console.error);
  }, []);

  // ── Draw reward chart ────────────────────────────────────────
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || rewardHistory.length === 0) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = { top: 30, right: 20, bottom: 40, left: 60 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    const rewards = rewardHistory.map(d => d.reward);
    const minR = Math.min(...rewards, -0.5);
    const maxR = Math.max(...rewards, 0.5);
    const range = maxR - minR || 1;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();

      const val = maxR - (range * i) / 4;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(2), pad.left - 8, y + 4);
    }

    // Plot line
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    rewardHistory.forEach((d, i) => {
      const x = pad.left + (plotW * i) / Math.max(rewardHistory.length - 1, 1);
      const y = pad.top + plotH - ((d.reward - minR) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill under line
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0.0)');
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Episode', W / 2, H - 5);

    ctx.save();
    ctx.translate(15, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Avg Reward', 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Training Reward Curve', pad.left, 20);
  }, [rewardHistory]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // ── WebSocket subscription for training progress ─────────────
  useEffect(() => {
    if (!activeRun) return;

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe(`/topic/training/${activeRun.id}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            setActiveRun(prev => ({
              ...prev,
              currentTimestep: data.currentTimestep || prev.currentTimestep,
              currentEpisode: data.currentEpisode || prev.currentEpisode,
              latestAvgReward: data.avgReward ?? prev.latestAvgReward,
              status: data.status === 'completed' ? 'COMPLETED' :
                      data.status === 'failed' ? 'FAILED' :
                      prev.status,
              modelFileName: data.modelFileName || prev.modelFileName,
            }));

            if (data.eventType === 'episodeEnd' || data.currentEpisode) {
              setRewardHistory(prev => [...prev, {
                episode: data.currentEpisode,
                reward: data.avgReward,
                step: data.currentTimestep,
              }]);
            }

            if (data.rttUs !== undefined && data.throughputKbps !== undefined) {
              setMetricsData(prev => {
                const newData = [...prev, {
                  step: data.currentTimestep,
                  rttMs: data.rttUs / 1000.0,
                  throughputMbps: data.throughputKbps / 1000.0,
                }];
                return newData.slice(-100); // Keep last 100 points
              });
            }

            if (data.status === 'completed' || data.status === 'failed') {
              loadTrainingRuns();
            }
          } catch (e) {
            console.error('WS parse error:', e);
          }
        });
      },
    });
    client.activate();
    stompRef.current = client;

    return () => {
      if (stompRef.current) {
        stompRef.current.deactivate();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.id, loadTrainingRuns]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleHyperChange = (e) => {
    const { name, value } = e.target;
    setHyperparams({
      ...hyperparams,
      [name]: (name === 'networkArch' || name === 'rewardProfile') ? value : parseFloat(value),
    });
  };

  const handleCreateAndTrain = async (e) => {
    e.preventDefault();
    setStatus('Creating experiment...');

    try {
      // Step 1: Create experiment (topology config)
      let expId = experimentId;
      if (!expId) {
        if (!formData.topologyId) throw new Error("Please select a topology");
        const topo = topologies.find(t => t.id === Number(formData.topologyId));
        const payload = {
          name: formData.name,
          topologyId: topo.id,
          topology: 'dumbbell-dual',
          bottleneckBandwidthMbps: topo.bottleneckBandwidthMbps,
          baseDelayMs: topo.bottleneckDelayMs,
          queueType: topo.queueType
        };
        const result = await ExperimentService.createExperiment(payload);
        expId = result.experimentId;
        setExperimentId(expId);
      }

      // Step 2: Start training
      setStatus('Starting training...');
      const run = await TrainingService.startTraining(
        expId,
        hyperparams.totalTimesteps,
        hyperparams.learningRate,
        hyperparams.networkArch,
        hyperparams.rewardProfile,
      );
      setActiveRun(run);
      setRewardHistory([]);
      setMetricsData([]);
      setStatus(`Training started! Run #${run.id} queued.`);
      loadTrainingRuns();

    } catch (error) {
      console.error(error);
      setStatus('Failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleStopTraining = async () => {
    if (!activeRun) return;
    try {
      await TrainingService.stopTraining(activeRun.id);
      setActiveRun(prev => ({ ...prev, status: 'CANCELLED' }));
      setStatus('Training cancelled.');
      loadTrainingRuns();
    } catch (e) {
      console.error(e);
      setStatus('Failed to stop training.');
    }
  };

  const isTraining = activeRun && (activeRun.status === 'TRAINING' || activeRun.status === 'QUEUED');
  const progressPct = activeRun && activeRun.totalTimesteps > 0
    ? Math.min(100, ((activeRun.currentTimestep || 0) / activeRun.totalTimesteps) * 100)
    : 0;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#f1f5f9',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, #22d3ee, #8b5cf6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        🧪 Training Lab
      </h1>

      {/* ── Section 1: Topology + Hyperparams ─────────────────── */}
      <form onSubmit={handleCreateAndTrain}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '20px',
        }}>
          {/* Left: Topology Config */}
          <div style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #334155',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>
              Network Topology
            </h2>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Experiment Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Select Topology</label>
              <select name="topologyId" value={formData.topologyId} onChange={handleChange} style={inputStyle}>
                <option value="">-- Choose Topology --</option>
                {topologies.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.topologyType})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Training Hyperparameters */}
          <div style={{
            background: '#1e293b',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #334155',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>
              Training Hyperparameters
            </h2>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>
                Total Timesteps: <span style={{ color: '#22d3ee', fontWeight: 'bold' }}>
                  {hyperparams.totalTimesteps.toLocaleString()}
                </span>
              </label>
              <input type="range" name="totalTimesteps"
                min="50000" max="2000000" step="50000"
                value={hyperparams.totalTimesteps} onChange={handleHyperChange}
                style={{ width: '100%', accentColor: '#22d3ee' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                <span>50K</span><span>500K</span><span>1M</span><span>2M</span>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Learning Rate</label>
              <select name="learningRate" value={hyperparams.learningRate} onChange={handleHyperChange}
                style={inputStyle}>
                <option value={1e-4}>1e-4 (Expert Default)</option>
                <option value={3e-4}>3e-4 (Legacy)</option>
                <option value={1e-3}>1e-3 (Aggressive)</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Network Architecture</label>
              <select name="networkArch" value={hyperparams.networkArch} onChange={handleHyperChange}
                style={inputStyle}>
                <option value="128,128">Small [128, 128]</option>
                <option value="256,256">Medium [256, 256] (Expert Default)</option>
                <option value="256,256,128">Deep [256, 256, 128] (Legacy)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>RL Personality (Reward Profile)</label>
              <select name="rewardProfile" value={hyperparams.rewardProfile} onChange={handleHyperChange}
                style={inputStyle}>
                <option value="BALANCED">Balanced (Safe Throughput)</option>
                <option value="AGGRESSIVE">Aggressive (Max Throughput, Ignore Bufferbloat)</option>
                <option value="CALM">Calm (Zero Bufferbloat, Lower Throughput)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Start Training Button */}
        <button type="submit" disabled={isTraining}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '10px',
            cursor: isTraining ? 'not-allowed' : 'pointer',
            background: isTraining
              ? '#334155'
              : 'linear-gradient(135deg, #22d3ee, #8b5cf6)',
            color: '#fff',
            transition: 'all 0.3s ease',
            marginBottom: '12px',
          }}>
          {isTraining ? '⏳ Training in progress...' : '🚀 Start Training'}
        </button>

        {status && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '14px',
            background: status.includes('Failed') ? '#451a2e' : '#0c4a4a',
            color: status.includes('Failed') ? '#fca5a5' : '#5eead4',
            border: `1px solid ${status.includes('Failed') ? '#7f1d1d' : '#134e4a'}`,
          }}>
            {status}
          </div>
        )}
      </form>

      {/* ── Section 2: Training Progress ──────────────────────── */}
      {activeRun && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '20px',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0' }}>
              📊 Training Progress — Run #{activeRun.id}
            </h2>
            <div style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: activeRun.status === 'COMPLETED' ? '#065f46' :
                          activeRun.status === 'FAILED' ? '#7f1d1d' :
                          activeRun.status === 'CANCELLED' ? '#78350f' : '#1e3a5f',
              color: activeRun.status === 'COMPLETED' ? '#6ee7b7' :
                     activeRun.status === 'FAILED' ? '#fca5a5' :
                     activeRun.status === 'CANCELLED' ? '#fbbf24' : '#7dd3fc',
            }}>
              {activeRun.status}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                Step {(activeRun.currentTimestep || 0).toLocaleString()} / {(activeRun.totalTimesteps || 0).toLocaleString()}
              </span>
              <span style={{ fontSize: '13px', color: '#22d3ee', fontWeight: 'bold' }}>
                {progressPct.toFixed(1)}%
              </span>
            </div>
            <div style={{
              height: '8px',
              borderRadius: '4px',
              background: '#0f172a',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                borderRadius: '4px',
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #22d3ee, #8b5cf6)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Episode', value: activeRun.currentEpisode || 0 },
              { label: 'Avg Reward', value: (activeRun.latestAvgReward || 0).toFixed(4) },
              { label: 'Learning Rate', value: activeRun.learningRate || '3e-4' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: '#0f172a',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{stat.label}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#e2e8f0' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Reward Chart */}
          <canvas
            ref={canvasRef}
            width={820}
            height={250}
            style={{ width: '100%', borderRadius: '8px', marginBottom: '20px' }}
          />

          {/* Real-time Metrics Chart (RTT & Tput) */}
          {metricsData.length > 0 && (
            <div style={{ width: '100%', height: '250px', marginBottom: '20px', background: '#0f172a', borderRadius: '8px', padding: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="step" stroke="#94a3b8" />
                  <YAxis yAxisId="left" orientation="left" stroke="#22d3ee" domain={['auto', 'auto']} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="throughputMbps" stroke="#22d3ee" dot={false} name="Throughput (Mbps)" isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="rttMs" stroke="#10b981" dot={false} name="RTT (ms)" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stop Button */}
          {isTraining && (
            <button onClick={handleStopTraining}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                background: '#7f1d1d',
                color: '#fca5a5',
                border: '1px solid #991b1b',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}>
              🛑 Stop Training
            </button>
          )}
        </div>
      )}

      {/* ── Section 3: Past Training Runs ─────────────────────── */}
      {trainingRuns.length > 0 && (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '20px',
          marginTop: '20px',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#e2e8f0', marginBottom: '16px' }}>
            📋 Training History
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Run', 'Steps', 'Episodes', 'Avg Reward', 'Status', 'Model'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: '600',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainingRuns.map(run => (
                <tr key={run.id} style={{
                  borderBottom: '1px solid #1e293b',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#0f172a'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => {
                    setActiveRun(run);
                    setRewardHistory([]);
                  }}
                >
                  <td style={cellStyle}>#{run.id}</td>
                  <td style={cellStyle}>{(run.currentTimestep || 0).toLocaleString()} / {(run.totalTimesteps || 0).toLocaleString()}</td>
                  <td style={cellStyle}>{run.currentEpisode || 0}</td>
                  <td style={cellStyle}>{(run.latestAvgReward || 0).toFixed(4)}</td>
                  <td style={cellStyle}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: run.status === 'COMPLETED' ? '#065f46' :
                                  run.status === 'FAILED' ? '#7f1d1d' :
                                  run.status === 'TRAINING' ? '#1e3a5f' :
                                  run.status === 'QUEUED' ? '#78350f' : '#334155',
                      color: run.status === 'COMPLETED' ? '#6ee7b7' :
                             run.status === 'FAILED' ? '#fca5a5' :
                             run.status === 'TRAINING' ? '#7dd3fc' :
                             run.status === 'QUEUED' ? '#fbbf24' : '#94a3b8',
                    }}>
                      {run.status}
                    </span>
                  </td>
                  <td style={cellStyle}>{run.modelFileName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared Styles ─────────────────────────────────────────────
const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '500',
  color: '#94a3b8',
  marginBottom: '4px',
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#e2e8f0',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const cellStyle = {
  padding: '10px 12px',
  fontSize: '13px',
  color: '#cbd5e1',
};