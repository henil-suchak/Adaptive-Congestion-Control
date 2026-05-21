package com.HAJ.congestion.controller;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.service.ExperimentService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "http://localhost:5173") // 1. Added CORS specifically for your Vite frontend
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

    // 2. Updated to catch the "model" query parameter from React
    @PostMapping("/experiments/{experimentId}/start")
    public void startExperiment(
            @PathVariable Long experimentId,
            @RequestParam(name = "model", defaultValue = "sac_baseline_v1") String modelName
    ) {
        System.out.println("Frontend requested to start Experiment: " + experimentId + " with Model: " + modelName);
        
        // Passing the modelName down to the service layer
        experimentService.startExperiment(experimentId, modelName); 
    }

    @PostMapping("/experiments/{experimentId}/end")
    public void endExperiment(@PathVariable Long experimentId) {
        experimentService.endExperiment(experimentId);
    }

    @GetMapping("/experiments/{experimentId}")
    public Experiment getExperimentById(@PathVariable Long experimentId) {
        return experimentService.getExperimentById(experimentId);
    }
    // Add this to ExperimentController.java
    @GetMapping("/experiments")
    public List<Experiment> getAllExperiments() {
        return experimentService.getAllExperiment();
    }
}