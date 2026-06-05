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

    public ExperimentServiceImpl(ExperimentRepository experimentRepository,
                                 TelemetrySimulator telemetrySimulator,
                                 RestTemplate restTemplate,
                                 SimulationQueueService simulationQueueService) {
        this.experimentRepository = experimentRepository;
        this.telemetrySimulator = telemetrySimulator;
        this.restTemplate = restTemplate;
        this.simulationQueueService = simulationQueueService;
    }

    @Override
    @CacheEvict(value = "experiments", allEntries = true)
    public Experiment createExperiment(String Name, String Topology, Double bottleneckBandwidthMbps, Double baseDelayMs, String queueType) {
        Experiment experiment = new Experiment(Name, Topology, bottleneckBandwidthMbps, baseDelayMs, queueType, ExperimentStatus.CREATED);
        return experimentRepository.save(experiment);
    }

    @Override
    @CacheEvict(value = "experiments", allEntries = true)
    public void startExperiment(Long experimentId, String modelName) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));

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
    @Cacheable("experiments")
    public List<Experiment> getAllExperiment(){
        return experimentRepository.findAll();
    }

    @Override
    @CacheEvict(value = "experiments", allEntries = true)
    public void endExperiment(Long experimentId) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));

        if (experiment.getStatus() == ExperimentStatus.COMPLETED) {
            System.out.println("[EndExperiment] Experiment " + experimentId + " is already COMPLETED — skipping.");
            return;
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
        return experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
    }

    @Override
    public int getQueuePosition(Long experimentId) {
        return simulationQueueService.getQueuePosition(experimentId);
    }
}