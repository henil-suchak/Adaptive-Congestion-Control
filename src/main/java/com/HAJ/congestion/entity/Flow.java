package com.HAJ.congestion.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "flows")
public class Flow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long flowId;

    @Column(nullable = false)
    private String sender;

    @Column(nullable = false)
    private String receiver;

    @Column(nullable = false)
    private String protocol;   // TCP Reno, Cubic, BBR, etc.

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "experiment_id", nullable = false)
    private Experiment experiment;

    /* ---------- Constructors ---------- */

    public Flow() {}

    public Flow(String sender, String receiver, String protocol, Experiment experiment) {
        this.sender = sender;
        this.receiver = receiver;
        this.protocol = protocol;
        this.experiment = experiment;
    }

    /* ---------- Getters ---------- */

    public Long getFlowId() {
        return flowId;
    }

    public String getSender() {
        return sender;
    }

    public String getReceiver() {
        return receiver;
    }

    public String getProtocol() {
        return protocol;
    }

    public Experiment getExperiment() {
        return experiment;
    }
}
