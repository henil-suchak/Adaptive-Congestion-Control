const queueOptions = ['FqCoDel', 'CoDel', 'PfifoFast', 'DropTail'];

export default function EdgeConfigPanel({ edge, onUpdate, onClose }) {
  if (!edge) return null;

  const data = edge.data || {};

  const handleChange = (field, value) => {
    onUpdate(edge.id, { ...data, [field]: value });
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-800">🔗 Link Configuration</h3>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 text-lg"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Bandwidth */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Bandwidth (Mbps)
          </label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={data.bandwidthMbps || 2}
            onChange={(e) => handleChange('bandwidthMbps', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Delay */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Delay (ms)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.1"
            value={data.delayMs || 20}
            onChange={(e) => handleChange('delayMs', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Queue Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Queue Discipline
          </label>
          <select
            value={data.queueType || 'FqCoDel'}
            onChange={(e) => handleChange('queueType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
          >
            {queueOptions.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        {/* Queue Size */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Queue Size (packets)
          </label>
          <input
            type="number"
            min="1"
            value={data.queueSize || 100}
            onChange={(e) => handleChange('queueSize', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Error Rate */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Packet Error Rate
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.001"
            value={data.errorRate || 0}
            onChange={(e) => handleChange('errorRate', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-xs font-semibold text-indigo-800 mb-1">Link Summary</p>
          <p className="text-xs text-indigo-600">
            {data.bandwidthMbps || 2} Mbps · {data.delayMs || 20}ms delay · {data.queueType || 'FqCoDel'}
          </p>
        </div>
      </div>
    </div>
  );
}
