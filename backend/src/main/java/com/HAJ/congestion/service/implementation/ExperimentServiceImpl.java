package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.repository.ExperimentRepository;
import com.HAJ.congestion.service.ExperimentService;
import com.HAJ.congestion.service.SimulationQueueService;
import com.HAJ.congestion.service.TelemetrySimulator;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ExperimentServiceImpl implements ExperimentService {

    private final ExperimentRepository experimentRepository;
    private final TelemetrySimulator telemetrySimulator;
    private final RestTemplate restTemplate;
    private final SimulationQueueService simulationQueueService;
    private final com.HAJ.congestion.security.SecurityUtils securityUtils;

    public ExperimentServiceImpl(ExperimentRepository experimentRepository,
                                 TelemetrySimulator telemetrySimulator,
                                 RestTemplate restTemplate,
                                 SimulationQueueService simulationQueueService,
                                 com.HAJ.congestion.security.SecurityUtils securityUtils) {
        this.experimentRepository = experimentRepository;
        this.telemetrySimulator = telemetrySimulator;
        this.restTemplate = restTemplate;
        this.simulationQueueService = simulationQueueService;
        this.securityUtils = securityUtils;
    }

    @Override
    @CacheEvict(value = "experiments", allEntries = true)
    public Experiment createExperiment(String Name, String Topology, Double bottleneckBandwidthMbps, Double baseDelayMs, String queueType, Long topologyId) {
        Experiment experiment = new Experiment(Name, Topology, bottleneckBandwidthMbps, baseDelayMs, queueType, ExperimentStatus.CREATED);
        experiment.setUserId(securityUtils.getCurrentUserId());
        experiment.setTopologyId(topologyId);
        return experimentRepository.save(experiment);
    }

    @Override
    @CacheEvict(value = "experiments", allEntries = true)
    public void startExperiment(Long experimentId, String modelName) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));

        if (experiment.getUserId() != null && !experiment.getUserId().equals(securityUtils.getCurrentUserId())) {
            throw new RuntimeException("Access Denied: You do not own this experiment");
        }

        if (experiment.getStatus() == ExperimentStatus.RUNNING) {
            System.out.println("[StartExperiment] Experiment " + experimentId + " is RUNNING — auto-stopping first...");
            simulationQueueService.stopExperiment(experimentId);
        }

        System.out.println("==================================================");
        System.out.println("SERVICE LAYER: Preparing to launch AI INFERENCE Engine...");
        System.out.println(" - Target Experiment ID: " + experimentId);
        System.out.println(" - Selected AI Model: " + modelName);
        System.out.println(" - Previous Status: " + experiment.getStatus());
        System.out.println("==================================================");

        // Set status to QUEUED (queue poller will change to RUNNING when dispatched)
        experiment.setStatus(ExperimentStatus.QUEUED);
        experiment.setEndTime(null);
        experimentRepository.save(experiment);

        // Enqueue the job — the SimulationQueueService poller will dispatch it
        simulationQueueService.enqueue(experimentId, modelName);

        System.out.println("📥 [StartExperiment] Experiment " + experimentId + " enqueued for dispatch.");
    }

    @Override
    public List<Experiment> getAllExperiment(){
        return experimentRepository.findByUserIdOrUserIdIsNull(securityUtils.getCurrentUserId());
    }

    @Override
    @CacheEvict(value = "experiments", allEntries = true)
    public void endExperiment(Long experimentId) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));

        if (experiment.getUserId() != null && !experiment.getUserId().equals(securityUtils.getCurrentUserId())) {
            throw new RuntimeException("Access Denied: You do not own this experiment");
        }

        if (experiment.getStatus() == ExperimentStatus.COMPLETED) {
            System.out.println("[EndExperiment] Experiment " + experimentId + " is already COMPLETED in DB, but we will send a kill signal anyway just in case.");
        }

        System.out.println("==================================================");
        System.out.println("SERVICE LAYER: Halting AI INFERENCE Engine...");
        System.out.println(" - Target Experiment ID: " + experimentId);
        System.out.println(" - Current Status: " + experiment.getStatus());
        System.out.println("==================================================");

        // Use the queue service to find and stop the right sidecar
        simulationQueueService.stopExperiment(experimentId);

        experiment.setStatus(ExperimentStatus.COMPLETED);
        experiment.setEndTime(LocalDateTime.now());
        experimentRepository.save(experiment);
    }

    @Override
    public Experiment getExperimentById(Long experimentId) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
        if (experiment.getUserId() != null && !experiment.getUserId().equals(securityUtils.getCurrentUserId())) {
            throw new RuntimeException("Access Denied: You do not own this experiment");
        }
        return experiment;
    }

    @Override
    public int getQueuePosition(Long experimentId) {
        return simulationQueueService.getQueuePosition(experimentId);
    }
}