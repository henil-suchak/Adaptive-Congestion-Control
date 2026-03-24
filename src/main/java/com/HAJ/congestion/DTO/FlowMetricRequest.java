package com.HAJ.congestion.DTO;

import java.time.LocalDateTime;

public class FlowMetricRequest {

    // OPTIONAL — backend will auto-fill
    private LocalDateTime timestamp;

    // Flow ID — sent by BackendManager so we don't hardcode 1L
    private Long flowId;

    private Double rttMs;
    private Double throughputMbps;
    private Double packetLossRate;
    private Double cwnd;
    private Double sendingRateMbps;
    private Double reward;
    private Double action;

    public Long getFlowId() {
        return flowId;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public Double getRttMs() {
        return rttMs;
    }

    public Double getThroughputMbps() {
        return throughputMbps;
    }

    public Double getPacketLossRate() {
        return packetLossRate;
    }

    public Double getCwnd() {
        return cwnd;
    }

    public Double getSendingRateMbps() {
        return sendingRateMbps;
    }

    public Double getReward() {
        return reward;
    }

    public Double getAction() {
        return action;
    }
}