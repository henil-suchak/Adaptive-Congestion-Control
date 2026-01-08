package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.repository.FlowMetricRepository;
import com.HAJ.congestion.repository.FlowRepository;
import com.HAJ.congestion.service.FlowMetricService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class FlowMetricServiceImpl implements FlowMetricService {
    private final FlowRepository flowRepository;
    private final FlowMetricRepository flowMetricRepository;

    public FlowMetricServiceImpl(FlowRepository flowRepository,FlowMetricRepository flowMetricRepository){
        this.flowRepository=flowRepository;
        this.flowMetricRepository=flowMetricRepository;
    }
    @Override
    public void recordFlowMetric(Long flowId, LocalDateTime timestamp, Double rttMs , Double throughputMbps , Double packetLossRate, Double cwnd, Double sendingRateMbps){
        var flow=flowRepository.findById(flowId).orElseThrow(()-> new IllegalArgumentException("Flow not Found: "+ flowId));
        Experiment experiment=flow.getExperiment();
        if(experiment.getStatus()!= ExperimentStatus.RUNNING){
            throw new IllegalArgumentException("Experiment is not in running state");
        }
        FlowMetric flowMetric= new FlowMetric(   timestamp,  rttMs ,  throughputMbps ,  packetLossRate,  cwnd,  sendingRateMbps,flow);
        flowMetricRepository.save(flowMetric);
    }
    @Override
    public List<FlowMetric> getMetricsForFlow(Long flowId){
        return flowMetricRepository.findAllByFlowFlowId(flowId);
    }
    @Override
    public List<FlowMetric> getMetricForExperiment(Long experimentId){
        return flowMetricRepository.findByFlowExperimentExperimentId(experimentId);
    }
}
