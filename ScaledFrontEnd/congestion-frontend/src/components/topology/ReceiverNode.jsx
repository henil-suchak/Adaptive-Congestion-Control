import { Handle, Position } from '@xyflow/react';

const style = {
  wrapper: {
    padding: '12px 18px',
    borderRadius: '10px',
    border: '2px solid #f43f5e',
    background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    minWidth: 130,
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(244, 63, 94, 0.15)',
  },
  icon: { fontSize: 22, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 600, color: '#881337' },
  sub: { fontSize: 10, color: '#f43f5e', marginTop: 2 },
};

export default function ReceiverNode({ data }) {
  return (
    <div style={style.wrapper}>
      <Handle type="target" position={Position.Left} style={{ background: '#f43f5e' }} />
      <div style={style.icon}>📥</div>
      <div style={style.label}>{data.label || 'Receiver'}</div>
      <div style={style.sub}>TCP Sink</div>
    </div>
  );
}
