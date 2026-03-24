package com.HAJ.congestion.controller;

import com.HAJ.congestion.DTO.FlowMetricDTO;
import com.HAJ.congestion.DTO.FlowMetricRequest;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.service.FlowMetricService;
import com.HAJ.congestion.service.PredictionService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
public class FlowMetricController {

    private final FlowMetricService flowMetricService;
    private final PredictionService predictionService;
    private final SimpMessagingTemplate messagingTemplate;

    public FlowMetricController(FlowMetricService flowMetricService,
                                PredictionService predictionService,
                                SimpMessagingTemplate messagingTemplate) {
        this.flowMetricService = flowMetricService;
        this.predictionService = predictionService;
        this.messagingTemplate = messagingTemplate;
    }

    /* =====================================================
     * 🔹 AGENT INGESTION ENDPOINT
     * ===================================================== */

    @PostMapping("/metrics")
    public FlowMetric ingestFromAgent(
            @RequestBody FlowMetricRequest request) {

        Long flowId = (request.getFlowId() != null) ? request.getFlowId() : 1L;

        FlowMetric flowMetric = flowMetricService.recordFlowMetric(
                flowId,
                request.getTimestamp(),
                request.getRttMs(),
                request.getThroughputMbps(),
                request.getPacketLossRate(),
                request.getCwnd(),
                request.getSendingRateMbps(),
                request.getReward(),
                request.getAction()
        );

        predictionService.generateAndSavePrediction(flowMetric);

        // Broadcast DTO (not entity) to avoid LazyInitializationException
        FlowMetricDTO dto = new FlowMetricDTO(flowMetric);
        messagingTemplate.convertAndSend("/topic/metrics", dto);

        return flowMetric;
    }

    /* =====================================================
     * 🔹 EXISTING ENDPOINTS
     * ===================================================== */

    @PostMapping("/flows/{flowId}/metrics")
    public FlowMetric recordMetric(
            @PathVariable Long flowId,
            @RequestBody FlowMetricRequest metric
    ) {
        return flowMetricService.recordFlowMetric(
                flowId,
                metric.getTimestamp(),
                metric.getRttMs(),
                metric.getThroughputMbps(),
                metric.getPacketLossRate(),
                metric.getCwnd(),
                metric.getSendingRateMbps(),
                metric.getReward(),
                metric.getAction()
        );
    }

    @GetMapping("/flows/{flowId}/metrics")
    public List<FlowMetric> getMetricsForFlow(@PathVariable Long flowId) {
        return flowMetricService.getMetricsForFlow(flowId);
    }

    @GetMapping("/experiments/{experimentId}/metrics")
    public List<FlowMetric> getMetricsForExperiment(
            @PathVariable Long experimentId) {
        return flowMetricService.getMetricForExperiment(experimentId);
    }

    @GetMapping("/metrics/latest")
    public List<FlowMetric> getLatestMetrics() {
        return flowMetricService.getLatestMetrics();
    }
}