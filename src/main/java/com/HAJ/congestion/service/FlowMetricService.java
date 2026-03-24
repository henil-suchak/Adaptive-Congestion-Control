package com.HAJ.congestion.service;

import com.HAJ.congestion.entity.FlowMetric;

import java.time.LocalDateTime;
import java.util.List;

public interface FlowMetricService {

    FlowMetric recordFlowMetric(
            Long flowId,
            LocalDateTime timestamp,
            Double rttMs,
            Double throughputMbps,
            Double packetLossRate,
            Double cwnd,
            Double sendingRateMbps,
            Double reward,
            Double action
    );

    List<FlowMetric> getMetricsForFlow(Long flowId);

    List<FlowMetric> getMetricForExperiment(Long experimentId);

    List<FlowMetric> getLatestMetrics();
}