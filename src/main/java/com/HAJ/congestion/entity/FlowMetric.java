package com.HAJ.congestion.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "flow_metrics")
public class FlowMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long metricId;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    private Double rttMs;
    private Double throughputMbps;
    private Double packetLossRate;
    private Double cwndBytes;
    private Double sendingRateMbps;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flow_id", nullable = false)
    private Flow flow;

    /* ---------- Constructors ---------- */

    public FlowMetric() {}

    public FlowMetric(LocalDateTime timestamp,
                      Double rttMs,
                      Double throughputMbps,
                      Double packetLossRate,
                      Double cwnd,
                      Double sendingRateMbps,
                      Flow flow) {
        this.timestamp = timestamp;
        this.rttMs = rttMs;
        this.throughputMbps = throughputMbps;
        this.packetLossRate = packetLossRate;
        this.cwndBytes = cwnd;
        this.sendingRateMbps = sendingRateMbps;
        this.flow = flow;
    }

    /* ---------- Getters ---------- */

    public Long getMetricId() {
        return metricId;
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

    public Double getCwndBytes() {
        return cwndBytes;
    }

    public Double getSendingRateMbps() {
        return sendingRateMbps;
    }

    public Flow getFlow() {
        return flow;
    }
}