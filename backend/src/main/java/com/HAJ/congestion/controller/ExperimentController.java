package com.HAJ.congestion.controller;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.service.ExperimentService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

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
                experiment.getName(), experiment.getTopology(),
                experiment.getBottleneckBandwidthMbps(), experiment.getBaseDelayMs(), experiment.getQueueType(),
                experiment.getTopologyId()
        );
    }

    @PostMapping("/experiments/{experimentId}/start")
    public void startExperiment(
            @PathVariable("experimentId") Long experimentId,
            @RequestParam(name = "model", defaultValue = "sac_baseline_v1") String modelName
    ) {
        System.out.println("Frontend requested to start Experiment: " + experimentId + " with Model: " + modelName);
        experimentService.startExperiment(experimentId, modelName);
    }

    @PostMapping("/experiments/{experimentId}/end")
    public void endExperiment(@PathVariable("experimentId") Long experimentId) {
        experimentService.endExperiment(experimentId);
    }

    @GetMapping("/experiments/{experimentId}")
    public Experiment getExperimentById(@PathVariable("experimentId") Long experimentId) {
        return experimentService.getExperimentById(experimentId);
    }

    @GetMapping("/experiments")
    public List<Experiment> getAllExperiments() {
        return experimentService.getAllExperiment();
    }

    /**
     * Returns the queue position of an experiment (1-indexed).
     * Returns 0 if the experiment is not in the queue (already running or completed).
     */
    @GetMapping("/experiments/{experimentId}/queue-position")
    public Map<String, Object> getQueuePosition(@PathVariable("experimentId") Long experimentId) {
        int position = experimentService.getQueuePosition(experimentId);
        return Map.of(
                "experimentId", experimentId,
                "queuePosition", position,
                "inQueue", position > 0
        );
    }
}