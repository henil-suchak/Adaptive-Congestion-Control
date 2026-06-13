import { Handle, Position } from '@xyflow/react';

const style = {
  wrapper: {
    padding: '12px 18px',
    borderRadius: '10px',
    border: '2px solid #10b981',
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    minWidth: 130,
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
  },
  icon: { fontSize: 22, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#064e3b' },
  algo: {
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    background: '#10b981',
    borderRadius: 4,
    padding: '2px 6px',
    marginTop: 4,
    display: 'inline-block',
  },
};

export default function SenderNode({ data }) {
  return (
    <div style={style.wrapper}>
      <div style={style.icon}>📤</div>
      <div style={style.label}>{data.label || 'Sender'}</div>
      {data.algorithm && <div style={style.algo}>{data.algorithm}</div>}
      <Handle type="source" position={Position.Right} style={{ background: '#10b981' }} />
    </div>
  );
}
