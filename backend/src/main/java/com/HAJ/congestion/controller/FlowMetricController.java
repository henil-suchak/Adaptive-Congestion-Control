package com.HAJ.congestion.controller;

import com.HAJ.congestion.DTO.CongestionDecisionResponse;
import com.HAJ.congestion.DTO.FlowMetricRequest;
import com.HAJ.congestion.ML.DummyCongestionModel;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.service.FlowMetricService;
import com.HAJ.congestion.service.PredictionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/api")
public class FlowMetricController {
    private final FlowMetricService flowMetricService;
    private final PredictionService predictionService;
    public FlowMetricController(FlowMetricService flowMetricService, PredictionService predictionService){
        this.flowMetricService=flowMetricService;
        this.predictionService = predictionService;
    }
    @PostMapping("/flows/{flowId}/metrics")
    public CongestionDecisionResponse recordFlowMetric(
            @PathVariable Long flowId,
            @RequestBody FlowMetricRequest flowMetricRequest) {

        // 1️⃣ Save metric
        FlowMetric flowMetric = flowMetricService.recordFlowMetric(
                flowId,
                flowMetricRequest.getTimestamp(),
                flowMetricRequest.getRttMs(),
                flowMetricRequest.getThroughputMbps(),
                flowMetricRequest.getPacketLossRate(),
                flowMetricRequest.getCwndBytes(),
                flowMetricRequest.getSendingRateMbps()
        );

        // 2️⃣ Get predicted optimal rate
        double predictedRate = predictionService.generateAndSavePrediction(flowMetric);

        double currentRate = flowMetricRequest.getSendingRateMbps();

        // 3️⃣ Decide action
        String action;

        if (predictedRate < currentRate * 0.9) {
            action = "DECREASE";
        } else if (predictedRate > currentRate * 1.1) {
            action = "INCREASE";
        } else {
            action = "MAINTAIN";
        }

        // 4️⃣ Return decision
        return new CongestionDecisionResponse(action, predictedRate);
    }

    @GetMapping("/flows/{flowId}/metrics")
    public List<FlowMetric> getMetricsForFlow(@PathVariable Long flowId){
        return flowMetricService.getMetricsForFlow(flowId);
    }
    @GetMapping("/metrics/latest")
    public List<FlowMetric> getLatestMetrics() {
        return flowMetricService.getLatestMetrics();
    }

    @GetMapping("/experiments/{experimentId}/metrics")
    public List<FlowMetric> getMetricsForExperiments(@PathVariable Long experimentId){
        return flowMetricService.getMetricForExperiment(experimentId);
    }

}
