package com.HAJ.congestion.service;

import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.entity.Prediction;

public interface PredictionService {
    Prediction generateAndSavePrediction(FlowMetric flowMetric);
}
