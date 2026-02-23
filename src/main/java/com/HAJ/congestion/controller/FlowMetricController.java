package com.HAJ.congestion.controller;

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
    public FlowMetric recordFlowMetric(
            @PathVariable Long flowId,
            @RequestBody FlowMetricRequest flowMetricRequest){
            FlowMetric flowMetric= flowMetricService.recordFlowMetric(flowId, flowMetricRequest.getTimestamp(),flowMetricRequest.getRttMs(),flowMetricRequest.getThroughputMbps(),flowMetricRequest.getPacketLossRate(),flowMetricRequest.getCwndBytes(),flowMetricRequest.getSendingRateMbps());
            predictionService.generateAndSavePrediction(flowMetric);
            return flowMetric;
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
