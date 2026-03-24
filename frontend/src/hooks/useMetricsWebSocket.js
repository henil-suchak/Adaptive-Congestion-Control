import { useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const MAX_POINTS = 100;
const WS_URL = 'http://localhost:8080/ws';

export function useMetricsWebSocket() {
  const [metrics, setMetrics] = useState([]);
  const [current, setCurrent] = useState(null);
  const [connected, setConnected] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const clientRef = useRef(null);

  const handleMessage = useCallback((message) => {
    try {
      const metric = JSON.parse(message.body);
      setCurrent(metric);
      setStepCount(prev => prev + 1);
      setMetrics(prev => {
        const point = {
          time: new Date(metric.timestamp).toLocaleTimeString(),
          rtt: metric.rttMs || 0,
          throughput: metric.throughputMbps || 0,
          cwnd: (metric.cwndBytes || 0) / 1000, // KB for readability
          reward: metric.reward || 0,
          action: metric.action || 1.0,
          loss: metric.packetLossRate || 0,
        };
        const next = [...prev, point];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    } catch (e) {
      console.error('[ws] parse error:', e);
    }
  }, []);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      onConnect: () => {
        console.log('[ws] connected');
        setConnected(true);
        client.subscribe('/topic/metrics', handleMessage);
      },
      onDisconnect: () => {
        console.log('[ws] disconnected');
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error('[ws] STOMP error:', frame.headers['message']);
      },
      reconnectDelay: 2000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [handleMessage]);

  return { metrics, current, connected, stepCount };
}
