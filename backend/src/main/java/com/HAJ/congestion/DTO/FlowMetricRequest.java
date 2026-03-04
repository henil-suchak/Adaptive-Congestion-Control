package com.HAJ.congestion.DTO;

import java.time.LocalDateTime;

public class FlowMetricRequest {
    private LocalDateTime timestamp;
    private Double rttMs;
    private Double throughputMbps;
    private Double packetLossRate;
    private Double cwndBytes;
    private Double sendingRateMbps;

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

    public Double getCwndBytes() {
        return cwndBytes;
    }

    public Double getSendingRateMbps() {
        return sendingRateMbps;
    }
}
