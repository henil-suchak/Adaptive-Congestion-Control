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

    @Column(nullable = false)
    private String flowId;

    private Double rttMs;

    private Double throughputMbps;

    private Double packetLossRate;

    private Double cwnd;

    private Double sendingRateMbps;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "experiment_id", nullable = false)
    private Experiment experiment;

    /* ---------- Constructors ---------- */

    public FlowMetric() {
    }

    public FlowMetric(LocalDateTime timestamp,
                      String flowId,
                      Double rttMs,
                      Double throughputMbps,
                      Double packetLossRate,
                      Double cwnd,
                      Double sendingRateMbps,
                      Experiment experiment) {
        this.timestamp = timestamp;
        this.flowId = flowId;
        this.rttMs = rttMs;
        this.throughputMbps = throughputMbps;
        this.packetLossRate = packetLossRate;
        this.cwnd = cwnd;
        this.sendingRateMbps = sendingRateMbps;
        this.experiment = experiment;
    }

    /* ---------- Getters ---------- */

    public Long getMetricId() {
        return metricId;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public String getFlowId() {
        return flowId;
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

    public Experiment getExperiment() {
        return experiment;
    }
}