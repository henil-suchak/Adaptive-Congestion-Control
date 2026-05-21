package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.repository.ExperimentRepository;
import com.HAJ.congestion.service.TelemetrySimulator;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ExperimentServiceImpl implements com.HAJ.congestion.service.ExperimentService {
    
    private final ExperimentRepository experimentRepository;
    private final TelemetrySimulator telemetrySimulator;

    public ExperimentServiceImpl(ExperimentRepository experimentRepository,TelemetrySimulator telemetrySimulator) {
        this.experimentRepository = experimentRepository;
        this.telemetrySimulator= telemetrySimulator;
    }
    
    @Override
    public Experiment createExperiment(String Name, String Topology, Double bottleneckBandwidthMbps, Double baseDelayMs, String queueType) {
        Experiment experiment = new Experiment(Name, Topology, bottleneckBandwidthMbps, baseDelayMs, queueType, ExperimentStatus.CREATED);
        experimentRepository.save(experiment);
        return experiment;
    }
    
    // UPDATED: Now accepts the modelName from the React frontend
    @Override
    public void startExperiment(Long experimentId, String modelName) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
                
        if (experiment.getStatus() != ExperimentStatus.CREATED) {
            throw new IllegalStateException(
                    "Experiment can only be started from CREATED state"
            );
        }

        // --- NEW LOGGING FOR AI ENGINE HANDOFF ---
        System.out.println("==================================================");
        System.out.println("SERVICE LAYER: Preparing to launch AI Engine...");
        System.out.println(" - Target Experiment ID: " + experimentId);
        System.out.println(" - Selected AI Model: " + modelName);
        System.out.println("==================================================");

        experiment.setStatus(ExperimentStatus.RUNNING);
        experiment.setStartTime(LocalDateTime.now());
        experimentRepository.save(experiment);

        telemetrySimulator.startSimulation();
    }
    @Override
    public List<Experiment> getAllExperiment(){
        return experimentRepository.findAll();
    }
    @Override
    public void endExperiment(Long experimentId) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
                
        if (experiment.getStatus() != ExperimentStatus.RUNNING) {
            throw new IllegalStateException(
                    "Experiment can only be completed from RUNNING state"
            );
        }

        experiment.setStatus(ExperimentStatus.COMPLETED);
        experiment.setEndTime(LocalDateTime.now());
        experimentRepository.save(experiment);
        telemetrySimulator.stopSimulation();
    }
    
    @Override
    public Experiment getExperimentById(Long experimentId) {
        return experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
    }
}