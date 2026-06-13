import { Handle, Position } from '@xyflow/react';

const style = {
  wrapper: {
    padding: '12px 18px',
    borderRadius: '12px',
    border: '2px solid #6366f1',
    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    minWidth: 120,
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
  },
  icon: { fontSize: 22, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#312e81' },
  sub: { fontSize: 10, color: '#6366f1', marginTop: 2 },
};

export default function RouterNode({ data }) {
  return (
    <div style={style.wrapper}>
      <Handle type="target" position={Position.Left} style={{ background: '#6366f1' }} />
      <div style={style.icon}>🔀</div>
      <div style={style.label}>{data.label || 'Router'}</div>
      <div style={style.sub}>Forwarding Node</div>
      <Handle type="source" position={Position.Right} style={{ background: '#6366f1' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#6366f1' }} />
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#6366f1' }} />
    </div>
  );
}
