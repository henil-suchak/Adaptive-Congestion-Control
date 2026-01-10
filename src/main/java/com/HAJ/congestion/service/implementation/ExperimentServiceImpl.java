package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.repository.ExperimentRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

import static java.time.LocalDateTime.now;

@Service
public class ExperimentServiceImpl implements com.HAJ.congestion.service.ExperimentService{
    private final ExperimentRepository experimentRepository;
    public ExperimentServiceImpl(ExperimentRepository experimentRepository)
    {
        this.experimentRepository=experimentRepository;
    }
    @Override
    public Experiment createExperiment(String Name, String Topology, Double bottleneckBandwidthMbps, Double baseDelayMs, String queueType){
        Experiment experiment=new Experiment(Name,Topology,bottleneckBandwidthMbps,baseDelayMs,queueType,ExperimentStatus.CREATED);
        experimentRepository.save(experiment);
        return experiment;
    }
    @Override
    public void startExperiment(Long experimentId){
        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
        if (experiment.getStatus() != ExperimentStatus.CREATED) {
            throw new IllegalStateException(
                    "Experiment can only be started from CREATED state"
            );
        }

        experiment.setStatus(ExperimentStatus.RUNNING);
        experiment.setStartTime(LocalDateTime.now());
        experimentRepository.save(experiment);
    }
    @Override
    public void endExperiment(Long experimentId)
    {
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
    }
    @Override
    public Experiment getExperimentById(Long experimentId) {
        return experimentRepository.findById(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found"));
    }

}
