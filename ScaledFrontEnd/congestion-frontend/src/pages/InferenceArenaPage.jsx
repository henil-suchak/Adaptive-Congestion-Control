import { useState, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ExperimentService } from '../services/api';

export default function InferenceArenaPage() {
  // 1. React State
  const [metricsData, setMetricsData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sac_tcp_1500000_steps.zip'); 
  const [targetExperimentId, setTargetExperimentId] = useState(''); 
  const [availableExperiments, setAvailableExperiments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // 3. Trigger the backend engine
  const handleStartSimulation = async () => {
    if (!targetExperimentId || isLoading) return;
    setIsLoading(true);
    try {
      console.log(`Sending ignition command for Experiment ${targetExperimentId} using model: ${selectedModel}`);
      setMetricsData([]);
      await ExperimentService.startExperiment(targetExperimentId, selectedModel); 
    } catch (error) {
      console.error("Failed to start engine:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Trigger the kill switch
  const handleStopSimulation = async () => {
    if (!targetExperimentId || isLoading) return;
    setIsLoading(true);
    try {
      console.log(`Sending kill signal for Experiment ${targetExperimentId}...`);
      await ExperimentService.endExperiment(targetExperimentId); 
    } catch (error) {
      console.error("Failed to stop engine:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Setup the WebSocket Connection
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
              onChange={(e) => setTargetExperimentId(Number(e.target.value))}
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

          {/* THE MODEL SELECTOR */}
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-800 text-white border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <optgroup label="My Trained Models">
              {/* 🟢 ADD YOUR EXACT FILE HERE */}
              <option value="sac_tcp_1500000_steps.zip">My 1.5M Step SAC Model</option>
            </optgroup>
            <optgroup label="Platform Defaults">
              <option value="sac_baseline_v1">SAC Baseline (Balanced)</option>
              <option value="sac_high_throughput">SAC (High Throughput)</option>
            </optgroup>
            
          </select>

          {/* START BUTTON */}
          <button 
            onClick={handleStartSimulation}
            disabled={isLoading}
            className={`${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-2 px-6 rounded-lg transition shadow-lg border border-blue-400`}>
            {isLoading ? '⏳ Wait...' : '▶ Start'}
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