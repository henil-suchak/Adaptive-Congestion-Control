package com.HAJ.congestion.service;
import java.util.List;
import com.HAJ.congestion.entity.FlowMetric;

import java.time.LocalDateTime;

public interface FlowMetricService {
    void recordFlowMetric(Long flowId, LocalDateTime timestamp, Double rttMs ,Double throughputMbps , Double packetLossRate,Double cwnd, Double sendingRateMbps);
    List<FlowMetric> getMetricsForFlow(Long flowId);
    List<FlowMetric> getMetricForExperiment(Long experimentId);
}
