package com.HAJ.congestion.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
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
    @PrePersist
    public void prePersist() {
        this.timestamp = LocalDateTime.now();
    }
    private Double rttMs;
    private Double throughputMbps;
    private Double packetLossRate;
    private Double cwndBytes;
    private Double sendingRateMbps;
    @Column(nullable = true)
    private String algorithmType = "UNKNOWN";
    @JsonBackReference
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "flow_id", nullable = false)
    private Flow flow;
    private Double reward = 0.0;
    private Double action = 1.0;
    /* ---------- Constructors ---------- */

    public FlowMetric() {}

   public FlowMetric(LocalDateTime timestamp, Double rttMs, Double throughputMbps,
                  Double packetLossRate, Double cwnd, Double sendingRateMbps,
                  Double reward, Double action, Flow flow) {
    this.timestamp = timestamp;
    this.rttMs = rttMs;
    this.throughputMbps = throughputMbps;
    this.packetLossRate = packetLossRate;
    this.cwndBytes = cwnd;
    this.sendingRateMbps = sendingRateMbps;
    this.reward = reward != null ? reward : 0.0;
    this.action = action != null ? action : 1.0;
    this.flow = flow;
    this.algorithmType = "UNKNOWN";
}

    /* ---------- Getters ---------- */

    public Long getMetricId() {
        return metricId;
    }
    public Double getReward() { return reward; }
   public Double getAction() { return action; }
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
    public String getAlgorithmType() {
        return algorithmType;
    }

    public void setAlgorithmType(String algorithmType) {
        this.algorithmType = algorithmType;
    }
}