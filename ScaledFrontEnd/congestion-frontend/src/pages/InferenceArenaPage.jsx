import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ExperimentService, ModelService } from '../services/api';

export default function InferenceArenaPage() {
  // 1. React State
  const [metricsData, setMetricsData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sac_tcp_1500000_steps.zip'); 
  const [targetExperimentId, setTargetExperimentId] = useState(''); 
  const [availableExperiments, setAvailableExperiments] = useState([]);
  const [trainedModels, setTrainedModels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [experimentStatus, setExperimentStatus] = useState(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const pollingRef = useRef(null);

  // 2. Fetch all experiments when the page loads
  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const data = await ExperimentService.getAllExperiments();
        
        // Sort the data so the highest ID (newest) is at index 0
        const sortedData = data.sort((a, b) => b.experimentId - a.experimentId);
        
        // Use the sorted data for the state!
        setAvailableExperiments(sortedData);
        
        // Automatically select the most recently created experiment (now at index 0)
        if (sortedData.length > 0) {
          setTargetExperimentId(sortedData[0].experimentId);
        }
      } catch (error) {
        console.error("Failed to load experiments:", error);
      }
    };
    fetchExperiments();
  }, []);

  // 2b. Fetch trained models from backend
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const models = await ModelService.getAllModels();
        setTrainedModels(models);
      } catch (e) {
        console.error('Failed to load trained models:', e);
      }
    };
    fetchModels();
  }, []);

  // 3. Poll experiment status when QUEUED or RUNNING
  useEffect(() => {
    // Cleanup previous polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!targetExperimentId || !experimentStatus) return;
    if (experimentStatus !== 'QUEUED' && experimentStatus !== 'RUNNING') return;

    pollingRef.current = setInterval(async () => {
      try {
        const exp = await ExperimentService.getExperimentById(targetExperimentId);
        setExperimentStatus(exp.status);

        if (exp.status === 'QUEUED') {
          const qData = await ExperimentService.getQueuePosition(targetExperimentId);
          setQueuePosition(qData.queuePosition);
        } else {
          setQueuePosition(0);
        }

        // Stop polling when experiment completes or fails
        if (exp.status === 'COMPLETED' || exp.status === 'FAILED') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (error) {
        console.error("Status poll failed:", error);
      }
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [targetExperimentId, experimentStatus]);

  // 4. Trigger the backend engine
  const handleStartSimulation = async () => {
    if (!targetExperimentId || isLoading) return;
    setIsLoading(true);
    try {
      console.log(`Sending ignition command for Experiment ${targetExperimentId} using model: ${selectedModel}`);
      setMetricsData([]);
      await ExperimentService.startExperiment(targetExperimentId, selectedModel); 
      setExperimentStatus('QUEUED');
      setQueuePosition(1);
    } catch (error) {
      console.error("Failed to start engine:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Trigger the kill switch
  const handleStopSimulation = async () => {
    if (!targetExperimentId || isLoading) return;
    setIsLoading(true);
    try {
      console.log(`Sending kill signal for Experiment ${targetExperimentId}...`);
      await ExperimentService.endExperiment(targetExperimentId); 
      setExperimentStatus('COMPLETED');
      setQueuePosition(0);
    } catch (error) {
      console.error("Failed to stop engine:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Setup the WebSocket Connection
  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws');
    
    const stompClient = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log(str),
      reconnectDelay: 5000,
    });

    stompClient.onConnect = (frame) => {
      console.log('Connected to Spring Boot STOMP Broker');
      setIsConnected(true);

      stompClient.subscribe('/topic/metrics', (message) => {
        const newMetric = JSON.parse(message.body);
        
        // Auto-detect RUNNING status from incoming metrics
        if (experimentStatus === 'QUEUED') {
          setExperimentStatus('RUNNING');
          setQueuePosition(0);
        }
        
        setMetricsData((prevData) => {
          const updatedData = [...prevData, newMetric];
          return updatedData.length > 50 ? updatedData.slice(updatedData.length - 50) : updatedData;
        });
      });
    };

    stompClient.onWebSocketClose = () => {
      console.log('Connection lost! Server is unreachable.');
      setIsConnected(false);
    };
    
    stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    stompClient.activate();

    return () => {
      if (stompClient.connected) {
        stompClient.deactivate();
      }
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">The Inference Arena</h1>
        
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-gray-700">
            {isConnected ? 'System Live' : 'Connecting to Engine...'}
          </span>
        </div>
      </div>

      {/* Queue Status Banner */}
      {experimentStatus === 'QUEUED' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 rounded-full bg-amber-400 animate-pulse"></div>
            <div>
              <h3 className="font-semibold text-amber-800">Experiment Queued</h3>
              <p className="text-amber-700 text-sm">
                Your simulation is waiting for an available compute worker.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-700">#{queuePosition}</p>
            <p className="text-xs text-amber-600">in queue</p>
          </div>
        </div>
      )}

      {/* Running Status Banner */}
      {experimentStatus === 'RUNNING' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center space-x-3">
          <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
          <div>
            <h3 className="font-semibold text-green-800">Simulation Running</h3>
            <p className="text-green-700 text-sm">AI agent is actively controlling TCP congestion window.</p>
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="bg-slate-900 rounded-xl p-4 mb-6 text-white flex justify-between items-center shadow-md">
        <div>
          <h3 className="font-semibold text-lg">Engine Controls</h3>
          <p className="text-slate-400 text-sm">Deploy the SAC Agent to NS-3</p>
        </div>
        
        <div className="flex items-center space-x-4">
          
          {/* THE NEW ABSTRACTION: Experiment Selector */}
          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
            <label className="text-slate-400 text-sm font-medium">Target Run:</label>
            <select 
              value={targetExperimentId}
              onChange={(e) => {
                setTargetExperimentId(Number(e.target.value));
                setExperimentStatus(null);
                setQueuePosition(0);
              }}
              className="bg-transparent text-white focus:outline-none font-medium outline-none cursor-pointer"
            >
              {availableExperiments.length === 0 ? (
                <option value="">No experiments found...</option>
              ) : (
                availableExperiments.map((exp) => {
                  // NEW: Cut the string if it's longer than 45 characters
                  const displayName = exp.name.length > 45 
                    ? exp.name.substring(0, 45) + '...' 
                    : exp.name;

                  return (
                    <option key={exp.experimentId} value={exp.experimentId} className="bg-slate-800">
                      Run {exp.experimentId}: {displayName}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* THE MODEL SELECTOR — Dynamic from backend */}
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {trainedModels.length > 0 && (
              <optgroup label="My Trained Models">
                {trainedModels.map((m) => (
                  <option key={m.id} value={m.checkpointName}>
                    {m.checkpointName} ({(m.totalSteps || 0).toLocaleString()} steps)
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Platform Defaults">
              <option value="sac_tcp_1500000_steps.zip">SAC 1.5M Steps (Pre-trained)</option>
              <option value="sac_baseline_v1">SAC Baseline (Balanced)</option>
              <option value="sac_high_throughput">SAC (High Throughput)</option>
            </optgroup>
          </select>

          {/* START BUTTON */}
          <button 
            onClick={handleStartSimulation}
            disabled={isLoading || experimentStatus === 'QUEUED'}
            className={`${isLoading || experimentStatus === 'QUEUED' ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-2 px-6 rounded-lg transition shadow-lg border border-blue-400`}>
            {experimentStatus === 'QUEUED' ? '⏳ Queued' : isLoading ? '⏳ Wait...' : '▶ Start'}
          </button>

          {/* STOP BUTTON */}
          <button 
            onClick={handleStopSimulation}
            disabled={isLoading}
            className={`${isLoading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'} text-white font-bold py-2 px-6 rounded-lg transition shadow-lg border border-red-400`}>
            {isLoading ? '⏳ Wait...' : '⏹ Stop'}
          </button>
        </div>
      </div>

      {/* The Dashboard Canvas */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-6">Real-Time Throughput (Mbps)</h2>
        
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              
              <XAxis dataKey="timestamp" 
                     tickFormatter={(timeStr) => {
                       if (!timeStr) return '';
                       const date = new Date(timeStr);
                       return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
                     }} 
              />
              
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              
              <Line type="monotone" 
                    dataKey="throughputMbps" 
                    stroke="#0f172a" 
                    strokeWidth={3} 
                    dot={false} 
                    name="Throughput (Mbps)" 
                    isAnimationActive={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}