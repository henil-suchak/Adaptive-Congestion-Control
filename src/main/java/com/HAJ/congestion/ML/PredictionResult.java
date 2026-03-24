package com.HAJ.congestion.ML;

public class PredictionResult {
    private final Double predictionRateMbps;
    private  final Double confidence;

    public PredictionResult(Double predictionRateMbps, Double confidence) {
        this.predictionRateMbps = predictionRateMbps;
        this.confidence = confidence;
    }

    public Double getConfidence() {
        return confidence;
    }

    public Double getPredictionRateMbps() {
        return predictionRateMbps;
    }
}
