package com.HAJ.congestion.controller;

import com.HAJ.congestion.DTO.FlowMetricRequest;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.service.FlowMetricService;
import com.HAJ.congestion.service.PredictionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class FlowMetricController {

    private final FlowMetricService flowMetricService;
    private final PredictionService predictionService;

    public FlowMetricController(FlowMetricService flowMetricService,
                                PredictionService predictionService) {
        this.flowMetricService = flowMetricService;
        this.predictionService = predictionService;
    }

    /**
     * Record a new flow-level congestion metric
     */
    @PostMapping("/flows/{flowId}/metrics")
    public FlowMetric recordFlowMetric(
            @PathVariable Long flowId,
            @RequestBody FlowMetricRequest request) {

        FlowMetric flowMetric = flowMetricService.recordFlowMetric(
                flowId,
                request.getTimestamp(),
                request.getRttMs(),
                request.getThroughputMbps(),
                request.getPacketLossRate(),
                request.getCwnd(),
                request.getSendingRateMbps()
        );

        // Trigger dummy ML prediction (Phase-2 hook)
      predictionService.generateAndSavePrediction(flowMetric);

        // ✅ Always return saved entity
        return flowMetric;
    }

    /**
     * Get all metrics for a specific flow
     */
    @GetMapping("/flows/{flowId}/metrics")
    public List<FlowMetric> getMetricsForFlow(@PathVariable Long flowId) {
        return flowMetricService.getMetricsForFlow(flowId);
    }

    /**
     * Get all metrics for an experiment (across all flows)
     */
    @GetMapping("/experiments/{experimentId}/metrics")
    public List<FlowMetric> getMetricsForExperiment(@PathVariable Long experimentId) {
        return flowMetricService.getMetricForExperiment(experimentId);
    }
}
