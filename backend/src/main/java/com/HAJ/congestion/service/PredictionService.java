package com.HAJ.congestion.service;

import com.HAJ.congestion.entity.FlowMetric;

public interface PredictionService {
    double generateAndSavePrediction(FlowMetric flowMetric);
}
