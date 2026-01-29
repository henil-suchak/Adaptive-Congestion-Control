package com.HAJ.congestion.DTO;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDateTime;

public class FlowMetricRequest {

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS")
    private LocalDateTime timestamp;
    private Double rttMs;
    private Double throughputMbps;
    private Double packetLossRate;
    private Double cwnd;
    private Double sendingRateMbps;

    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Double getRttMs() {
        return rttMs;
    }
    public void setRttMs(Double rttMs) {
        this.rttMs = rttMs;
    }

    public Double getThroughputMbps() {
        return throughputMbps;
    }
    public void setThroughputMbps(Double throughputMbps) {
        this.throughputMbps = throughputMbps;
    }

    public Double getPacketLossRate() {
        return packetLossRate;
    }
    public void setPacketLossRate(Double packetLossRate) {
        this.packetLossRate = packetLossRate;
    }

    public Double getCwnd() {
        return cwnd;
    }
    public void setCwnd(Double cwnd) {
        this.cwnd = cwnd;
    }

    public Double getSendingRateMbps() {
        return sendingRateMbps;
    }
    public void setSendingRateMbps(Double sendingRateMbps) {
        this.sendingRateMbps = sendingRateMbps;
    }
}
