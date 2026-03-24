package com.HAJ.congestion.DTO;

import com.HAJ.congestion.entity.FlowMetric;

import java.time.LocalDateTime;

/**
 * Plain DTO for WebSocket broadcast.
 * Avoids LazyInitializationException from serializing the JPA entity
 * (which has @JsonBackReference + FetchType.LAZY on the flow field).
 */
public class FlowMetricDTO {

    private Long metricId;
    private LocalDateTime timestamp;
    private Double rttMs;
    private Double throughputMbps;
    private Double packetLossRate;
    private Double cwndBytes;
    private Double sendingRateMbps;
    private Double reward;
    private Double action;

    public FlowMetricDTO() {}

    public FlowMetricDTO(FlowMetric entity) {
        this.metricId = entity.getMetricId();
        this.timestamp = entity.getTimestamp();
        this.rttMs = entity.getRttMs();
        this.throughputMbps = entity.getThroughputMbps();
        this.packetLossRate = entity.getPacketLossRate();
        this.cwndBytes = entity.getCwndBytes();
        this.sendingRateMbps = entity.getSendingRateMbps();
        this.reward = entity.getReward();
        this.action = entity.getAction();
    }

    public Long getMetricId() { return metricId; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public Double getRttMs() { return rttMs; }
    public Double getThroughputMbps() { return throughputMbps; }
    public Double getPacketLossRate() { return packetLossRate; }
    public Double getCwndBytes() { return cwndBytes; }
    public Double getSendingRateMbps() { return sendingRateMbps; }
    public Double getReward() { return reward; }
    public Double getAction() { return action; }
}
