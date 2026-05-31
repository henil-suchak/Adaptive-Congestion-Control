package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.repository.ExperimentRepository;
import com.HAJ.congestion.service.TelemetrySimulator;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@Service
public class ExperimentServiceImpl implements com.HAJ.congestion.service.ExperimentService {

    private final ExperimentRepository experimentRepository;
    private final TelemetrySimulator telemetrySimulator;

    public ExperimentServiceImpl(ExperimentRepository experimentRepository, TelemetrySimulator telemetrySimulator) {
        this.experimentRepository = experimentRepository;
        this.telemetrySimulator= telemetrySimulator;
    }

    @Override
    public Experiment createExperiment(String Name, String Topology, Double bottleneckBandwidthMbps, Double baseDelayMs, String queueType) {
        Experiment experiment = new Experiment(Name, Topology, bottleneckBandwidthMbps, baseDelayMs, queueType, ExperimentStatus.CREATED);
        return experimentRepository.save(experiment);
    }

    @Override
    public void startExperiment(Long experimentId, String modelName) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));

        // If already running, stop the old run first before restarting
        if (experiment.getStatus() == ExperimentStatus.RUNNING) {
            System.out.println("[StartExperiment] Experiment " + experimentId + " is RUNNING — auto-stopping first...");
            stopPythonEngine(experimentId);
        }

        System.out.println("==================================================");
        System.out.println("SERVICE LAYER: Preparing to launch AI INFERENCE Engine...");
        System.out.println(" - Target Experiment ID: " + experimentId);
        System.out.println(" - Selected AI Model: " + modelName);
        System.out.println(" - Previous Status: " + experiment.getStatus());
        System.out.println("==================================================");

        experiment.setStatus(ExperimentStatus.RUNNING);
        experiment.setStartTime(LocalDateTime.now());
        experiment.setEndTime(null);
        experimentRepository.save(experiment);

        // --- HTTP BRIDGE TO PYTHON INFERENCE ENGINE ---
        RestTemplate restTemplate = new RestTemplate();
        String pythonApiUrl = "http://ns3-sim:8000/start";

        Map<String, Object> payload = new HashMap<>();
        payload.put("experimentId", experiment.getExperimentId());
        payload.put("topology", experiment.getTopology());
        payload.put("bandwidthMbps", experiment.getBottleneckBandwidthMbps());
        payload.put("delayMs", experiment.getBaseDelayMs());
        payload.put("simDuration", 200);
        payload.put("modelName", modelName);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(pythonApiUrl, payload, String.class);
            System.out.println("✅ Python Inference successfully ignited: " + response.getBody());
        } catch (Exception e) {
            System.err.println("❌ Failed to connect to Python Engine: " + e.getMessage());
            experiment.setStatus(ExperimentStatus.FAILED);
            experimentRepository.save(experiment);
        }
    }

    /** Sends a stop signal to the Python engine (best-effort, does not throw). */
    private void stopPythonEngine(Long experimentId) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String pythonStopUrl = "http://ns3-sim:8000/stop/" + experimentId;
            restTemplate.postForEntity(pythonStopUrl, null, String.class);
            System.out.println("🛑 [Auto-Stop] Python engine stopped for Exp " + experimentId);
        } catch (Exception e) {
            System.err.println("⚠️ [Auto-Stop] Could not reach Python engine: " + e.getMessage());
        }
    }
    @Override
    public List<Experiment> getAllExperiment(){
        return experimentRepository.findAll();
    }

    @Override
    public void endExperiment(Long experimentId) {
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));

        // Already completed — nothing to do, return silently instead of crashing
        if (experiment.getStatus() == ExperimentStatus.COMPLETED) {
            System.out.println("[EndExperiment] Experiment " + experimentId + " is already COMPLETED — skipping.");
            return;
        }

        System.out.println("==================================================");
        System.out.println("SERVICE LAYER: Halting AI INFERENCE Engine...");
        System.out.println(" - Target Experiment ID: " + experimentId);
        System.out.println(" - Current Status: " + experiment.getStatus());
        System.out.println("==================================================");

        // --- HTTP BRIDGE TO PYTHON INFERENCE ENGINE (STOP CALL) ---
        RestTemplate restTemplate = new RestTemplate();
        String pythonStopUrl = "http://ns3-sim:8000/stop/" + experimentId;

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(pythonStopUrl, null, String.class);
            System.out.println("🛑 Python Inference successfully halted: " + response.getBody());
        } catch (Exception e) {
            System.err.println("⚠️ Warning: Failed to reach Python Engine for shutdown: " + e.getMessage());
        }

        experiment.setStatus(ExperimentStatus.COMPLETED);
        experiment.setEndTime(LocalDateTime.now());
        experimentRepository.save(experiment);
    }
    @Override
    public Experiment getExperimentById(Long experimentId) {
        return experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
    }
}