import { useState } from 'react';
import { ExperimentService } from '../services/api';

export default function TrainingLabPage() {
  // 1. The React State (Holds the data while the user types)
  const [formData, setFormData] = useState({
    name: 'My Custom Topology',
    topology: 'dumbbell-dual',
    bottleneckBandwidthMbps: 2.0,
    baseDelayMs: 20.0,
    queueType: 'FqCoDel'
  });

  const [status, setStatus] = useState('');

  // 2. Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name.includes('Mbps') || name.includes('Ms') ? parseFloat(value) : value
    });
  };

  // 3. Submit to Spring Boot
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Creating experiment...');
    try {
      const result = await ExperimentService.createExperiment(formData);
      setStatus(`Success! Experiment created with ID: ${result.experimentId}`);
    } catch (error) {
      console.error(error);
      setStatus('Failed to connect to backend. Is Spring Boot running?');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">The Training Lab</h1>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Topology Configuration</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Experiment Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bandwidth (Mbps)</label>
              <input type="number" step="0.1" name="bottleneckBandwidthMbps" value={formData.bottleneckBandwidthMbps} onChange={handleChange} 
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            
            <div>
              <div>
  <label className="block text-sm font-medium text-gray-700">Base Delay (ms)</label>
  <input type="number" step="1" name="baseDelayMs" value={formData.baseDelayMs} onChange={handleChange} 
    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
  {/* The new helper text line: */}
  <p className="mt-1 text-xs text-gray-500">Tip: Use 10ms for local networks, 100ms for long-distance.</p>
</div>
                
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Queue Type</label>
            <select name="queueType" value={formData.queueType} onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white">
              <option value="FqCoDel">FqCoDel</option>
              <option value="DropTail">DropTail</option>
              <option value="RED">RED</option>
            </select>
          </div>

          <div className="pt-4">
            <button type="submit" 
              className="w-full bg-slate-900 text-white font-semibold py-2 px-4 rounded-md hover:bg-slate-800 transition">
              Create Environment
            </button>
          </div>
          
          {/* Status Message */}
          {status && (
            <div className={`mt-4 p-3 rounded text-sm ${status.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {status}
            </div>
          )}

        </form>
      </div>
    </div>
  );
}