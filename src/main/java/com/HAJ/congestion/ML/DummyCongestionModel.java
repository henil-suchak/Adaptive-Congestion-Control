package com.HAJ.congestion.ML;

import com.HAJ.congestion.entity.FlowMetric;
import org.springframework.stereotype.Component;

@Component
public class DummyCongestionModel {

    public PredictionResult predict(FlowMetric flowMetric) {

        double recommendedRate;
        double confidence;

        if (flowMetric.getPacketLossRate() > 0.05) {
            recommendedRate = flowMetric.getSendingRateMbps() * 0.7;
            confidence = 0.85;
        } else if (flowMetric.getRttMs() > 150) {
            recommendedRate = flowMetric.getSendingRateMbps() * 0.8;
            confidence = 0.75;
        } else {
            recommendedRate = flowMetric.getSendingRateMbps() * 1.06;
            confidence = 0.65;
        }

        return new PredictionResult(recommendedRate, confidence);
    }
}
