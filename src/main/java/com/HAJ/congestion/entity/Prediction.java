package com.HAJ.congestion.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "predictions")
public class Prediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long predictionId;

    @Column(nullable = false)
    private Double predictedRateMbps;

    @Column(nullable = false)
    private Double confidence;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flow_id", nullable = false)
    private Flow flow;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private ModelMetadata modelMetadata;

    /* ---------- Constructors ---------- */

    public Prediction() {}

    public Prediction(Double predictedRateMbps,
                      Double confidence,
                      LocalDateTime timestamp,
                      Flow flow,
                      ModelMetadata modelMetadata) {
        this.predictedRateMbps = predictedRateMbps;
        this.confidence = confidence;
        this.timestamp = timestamp;
        this.flow = flow;
        this.modelMetadata = modelMetadata;
    }

    /* ---------- Getters ---------- */

    public Long getPredictionId() {
        return predictionId;
    }

    public Double getPredictedRateMbps() {
        return predictedRateMbps;
    }

    public Double getConfidence() {
        return confidence;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public Flow getFlow() {
        return flow;
    }

    public ModelMetadata getModelMetadata() {
        return modelMetadata;
    }
}
