package com.HAJ.congestion.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "experiments")
public class Experiment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long experimentId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String topology;

    @Column(nullable = false)
    private Double bottleneckBandwidthMbps;

    @Column(nullable = false)
    private Double baseDelayMs;

    @Column(nullable = false)
    private String queueType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExperimentStatus status;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    @JsonManagedReference
    @OneToMany(mappedBy = "experiment")
    private List<Flow> flows;
    /* ---------- Constructors ---------- */

    public Experiment() {
    }

    public Experiment(String name,
                      String topology,
                      Double bottleneckBandwidthMbps,
                      Double baseDelayMs,
                      String queueType,
                      ExperimentStatus status) {
        this.name = name;
        this.topology = topology;
        this.bottleneckBandwidthMbps = bottleneckBandwidthMbps;
        this.baseDelayMs = baseDelayMs;
        this.queueType = queueType;
        this.status = status;
    }

    /* ---------- Getters & Setters ---------- */

    public Long getExperimentId() {
        return experimentId;
    }

    public String getName() {
        return name;
    }

    public String getTopology() {
        return topology;
    }

    public Double getBottleneckBandwidthMbps() {
        return bottleneckBandwidthMbps;
    }

    public Double getBaseDelayMs() {
        return baseDelayMs;
    }

    public String getQueueType() {
        return queueType;
    }

    public ExperimentStatus getStatus() {
        return status;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setStatus(ExperimentStatus status) {
        this.status = status;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }
}