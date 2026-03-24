package com.HAJ.congestion.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "model_metadata")
public class ModelMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long modelId;

    @Column(nullable = false)
    private String modelVersion;

    @Column(nullable = false)
    private String trainingDataset;

    @Column(nullable = false)
    private Double accuracy;

    @Column(nullable = false)
    private LocalDateTime creationTime;

    public ModelMetadata() {}

    public ModelMetadata(String modelVersion,
                         String trainingDataset,
                         Double accuracy,
                         LocalDateTime creationTime) {
        this.modelVersion = modelVersion;
        this.trainingDataset = trainingDataset;
        this.accuracy = accuracy;
        this.creationTime = creationTime;
    }

    public Long getModelId() {
        return modelId;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public String getTrainingDataset() {
        return trainingDataset;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public LocalDateTime getCreationTime() {
        return creationTime;
    }
}
