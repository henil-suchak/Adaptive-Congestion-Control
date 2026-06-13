const nodeTypes = [
  { type: 'sender',   icon: '📤', label: 'Sender',   desc: 'TCP source node (RL agent or baseline)' },
  { type: 'router',   icon: '🔀', label: 'Router',   desc: 'Packet forwarding node' },
  { type: 'receiver', icon: '📥', label: 'Receiver', desc: 'TCP sink node' },
];

export default function NodePalette() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-56 bg-white border-r border-gray-200 p-4 space-y-3 shrink-0">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
        Drag to Canvas
      </h3>
      {nodeTypes.map(({ type, icon, label, desc }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-grab
                     hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm transition-all
                     active:cursor-grabbing"
        >
          <span className="text-xl mt-0.5">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className="text-xs text-gray-500 leading-snug">{desc}</p>
          </div>
        </div>
      ))}

      <div className="mt-6 pt-4 border-t border-gray-100">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tips</h3>
        <ul className="space-y-1.5 text-xs text-gray-500">
          <li>• Drag nodes onto the canvas</li>
          <li>• Connect handles to create links</li>
          <li>• Click a link to configure it</li>
          <li>• Press Delete to remove selected</li>
        </ul>
      </div>
    </div>
  );
}
