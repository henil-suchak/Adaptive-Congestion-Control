package com.HAJ.congestion.service.implementation;


import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.ML.PredictionResult;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class MlClientService {

    private final RestTemplate restTemplate = new RestTemplate();

    public PredictionResult callMlModel(FlowMetric metric) {
        try {
            String url = "http://localhost:8000/predict";

            Map<String, Object> payload = Map.of(
                    "rttMs", metric.getRttMs() != null ? metric.getRttMs() : 0.0,
                    "packetLossRate", metric.getPacketLossRate() != null ? metric.getPacketLossRate() : 0.0,
                    "cwndBytes", metric.getCwndBytes() != null ? metric.getCwndBytes() : 0.0,
                    "throughputMbps", metric.getThroughputMbps() != null ? metric.getThroughputMbps() : 0.0,
                    "sendingRateMbps", metric.getSendingRateMbps() != null ? metric.getSendingRateMbps() : 0.0
            );

            Map response = restTemplate.postForObject(url, payload, Map.class);

            Double predictedRate = Double.valueOf(response.get("predictedRateMbps").toString());
            Double confidence = Double.valueOf(response.get("confidence").toString());

            return new PredictionResult(predictedRate, confidence);

        } catch (Exception e) {
            // ML service not running — return a default prediction
            double defaultRate = metric.getThroughputMbps() != null ? metric.getThroughputMbps() : 0.0;
            return new PredictionResult(defaultRate, 0.5);
        }
    }
}