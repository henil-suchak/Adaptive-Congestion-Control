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

        String url = "http://localhost:8000/predict";

        Map<String, Object> payload = Map.of(
                "rtt", metric.getRttMs(),
                "loss", metric.getPacketLossRate(),
                "cwnd", metric.getCwndBytes(),
                "throughput", metric.getThroughputMbps(),
                "sendingRate", metric.getSendingRateMbps()
        );

        Map response = restTemplate.postForObject(url, payload, Map.class);

        Double predictedRate =
                Double.valueOf(response.get("predictedRateMbps").toString());

        Double confidence =
                Double.valueOf(response.get("confidence").toString());

        return new PredictionResult(predictedRate, confidence);
    }
}
