package com.HAJ.congestion.controller;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.service.ExperimentService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ExperimentController {

    private final ExperimentService experimentService;

    public ExperimentController(ExperimentService experimentService) {
        this.experimentService = experimentService;
    }

    @PostMapping("/experiments")
    public Experiment createExperiment(@RequestBody Experiment experiment) {
        return experimentService.createExperiment(
                experiment.getName(),
                experiment.getTopology(),
                experiment.getBottleneckBandwidthMbps(),
                experiment.getBaseDelayMs(),
                experiment.getQueueType()
        );
    }

    @PostMapping("/experiments/{experimentId}/start")
    public void startExperiment(@PathVariable Long experimentId) {
        experimentService.startExperiment(experimentId);
    }

    @PostMapping("/experiments/{experimentId}/end")
    public void endExperiment(@PathVariable Long experimentId) {
        experimentService.endExperiment(experimentId);
    }

    @GetMapping("/experiments/{experimentId}")
    public Experiment getExperimentById(@PathVariable Long experimentId) {
        return experimentService.getExperimentById(experimentId);
    }
}
