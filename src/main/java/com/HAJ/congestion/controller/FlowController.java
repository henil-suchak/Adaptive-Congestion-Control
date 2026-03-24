package com.HAJ.congestion.controller;

import com.HAJ.congestion.entity.Flow;
import com.HAJ.congestion.service.FlowService;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class FlowController {
    private final FlowService flowService;

    public FlowController(FlowService flowService) {
        this.flowService = flowService;
    }
    @PostMapping("/experiments/{experimentId}/flows")
    public Flow createFlow(@PathVariable Long experimentId, @RequestBody Flow flow) {
        return flowService.createFlow(experimentId, flow);
    }
    @GetMapping("/experiments/{experimentId}/flows")
    public List<Flow> getFlowsByExperiment(@PathVariable Long experimentId) {
        return flowService.getFlowsByExperiment(experimentId);
    }
    @GetMapping("/flows/{flowId}")
    public Flow getFlowById(@PathVariable Long flowId) {
        return flowService.getFlowByFlowId(flowId);
    }


}
