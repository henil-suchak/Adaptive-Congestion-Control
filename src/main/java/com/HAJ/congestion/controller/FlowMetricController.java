package com.HAJ.congestion.controller;

import com.HAJ.congestion.DTO.FlowMetricRequest;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.service.FlowMetricService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class FlowMetricController {
    private final FlowMetricService flowMetricService;

    public FlowMetricController(FlowMetricService flowMetricService){
        this.flowMetricService=flowMetricService;
    }
    @PostMapping("/flows/{flowId}/metrics")
    public void recordFlowMetric(
            @PathVariable Long flowId,
            @RequestBody FlowMetricRequest flowMetricRequest){
            flowMetricService.recordFlowMetric(flowId, flowMetricRequest.getTimestamp(),flowMetricRequest.getRttMs(),flowMetricRequest.getThroughputMbps(),flowMetricRequest.getPacketLossRate(),flowMetricRequest.getCwnd(),flowMetricRequest.getSendingRateMbps());
    }

    @GetMapping("/flows/{flowId}/metrics")
    public List<FlowMetric> getMetricsForFlow(@PathVariable Long flowId){
        return flowMetricService.getMetricsForFlow(flowId);
    }

    @GetMapping("/experiments/{experimentId}/metrics")
    public List<FlowMetric> getMetricsForExperiments(@PathVariable Long experimentId){
        return flowMetricService.getMetricForExperiment(experimentId);
    }

}
