import { useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const MAX_POINTS = 100;
const WS_URL = 'http://localhost:8080/ws';

export function useMetricsWebSocket() {
  const [sacMetrics, setSacMetrics] = useState([]);
  const [cubicMetrics, setCubicMetrics] = useState([]);
  const [mergedMetrics, setMergedMetrics] = useState([]);
  const [sacCurrent, setSacCurrent] = useState(null);
  const [cubicCurrent, setCubicCurrent] = useState(null);
  const [connected, setConnected] = useState(false);
  const [sacStepCount, setSacStepCount] = useState(0);
  const [cubicStepCount, setCubicStepCount] = useState(0);
  const clientRef = useRef(null);

  const latestSacRef = useRef(null);
  const latestCubicRef = useRef(null);

  const handleMessage = useCallback((message) => {
    try {
      const metric = JSON.parse(message.body);
      const algo = (metric.algorithmType || 'SAC').toUpperCase();
      const time = new Date(metric.timestamp).toLocaleTimeString();

      if (algo === 'CUBIC') {
        setCubicCurrent(metric);
        setCubicStepCount(prev => prev + 1);
        latestCubicRef.current = metric;

        setCubicMetrics(prev => {
          const point = {
            time,
            rtt: metric.rttMs || 0,
            throughput: metric.throughputMbps || 0,
            cwnd: (metric.cwndBytes || 0) / 1000,
            reward: metric.reward || 0,
            action: metric.action || 0,
            loss: metric.packetLossRate || 0,
          };
          const next = [...prev, point];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
      } else {
        setSacCurrent(metric);
        setSacStepCount(prev => prev + 1);
        latestSacRef.current = metric;

        setSacMetrics(prev => {
          const point = {
            time,
            rtt: metric.rttMs || 0,
            throughput: metric.throughputMbps || 0,
            cwnd: (metric.cwndBytes || 0) / 1000,
            reward: metric.reward || 0,
            action: metric.action || 1.0,
            loss: metric.packetLossRate || 0,
          };
          const next = [...prev, point];
          return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
        });
      }

      // Build merged timeline for synchronized dual-line charts
      setMergedMetrics(prev => {
        const sac = latestSacRef.current;
        const cubic = latestCubicRef.current;

        const point = { time };

        if (sac) {
          point.sacRtt = sac.rttMs || 0;
          point.sacThroughput = sac.throughputMbps || 0;
          point.sacCwnd = (sac.cwndBytes || 0) / 1000;
          point.sacReward = sac.reward || 0;
        }
        if (cubic) {
          point.cubicRtt = cubic.rttMs || 0;
          point.cubicThroughput = cubic.throughputMbps || 0;
          point.cubicCwnd = (cubic.cwndBytes || 0) / 1000;
          point.cubicReward = cubic.reward || 0;
        }

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

  return {
    sacMetrics,
    cubicMetrics,
    mergedMetrics,
    sacCurrent,
    cubicCurrent,
    connected,
    sacStepCount,
    cubicStepCount,
  };
}
