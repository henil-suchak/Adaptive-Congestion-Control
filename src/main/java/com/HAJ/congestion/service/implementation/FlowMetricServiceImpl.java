package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.ML.DummyCongestionModel;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.entity.Flow;
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
    private final DummyCongestionModel dummyCongestionModel;

    public FlowMetricServiceImpl(
            FlowRepository flowRepository,
            FlowMetricRepository flowMetricRepository,
            DummyCongestionModel dummyCongestionModel) {

        this.flowRepository = flowRepository;
        this.flowMetricRepository = flowMetricRepository;
        this.dummyCongestionModel = dummyCongestionModel;
    }

    @Override
    public FlowMetric recordFlowMetric(
            Long flowId,
            LocalDateTime timestamp,
            Double rttMs,
            Double throughputMbps,
            Double packetLossRate,
            Double cwnd,
            Double sendingRateMbps,
            Double reward,
            Double action
    ) {
        Flow flow = flowRepository.findById(flowId)
                .orElseThrow(() -> new IllegalArgumentException("Flow not found"));

        if (flow.getExperiment().getStatus() != ExperimentStatus.RUNNING) {
            throw new IllegalStateException("Experiment not running");
        }

        LocalDateTime finalTs =
                (timestamp != null) ? timestamp : LocalDateTime.now();

        FlowMetric metric = new FlowMetric(
                finalTs,
                rttMs,
                throughputMbps,
                packetLossRate,
                cwnd,
                sendingRateMbps,
                reward,
                action,
                flow
        );

        return flowMetricRepository.save(metric);
    }

    @Override
    public List<FlowMetric> getMetricsForFlow(Long flowId) {
        return flowMetricRepository.findAllByFlowFlowId(flowId);
    }

    @Override
    public List<FlowMetric> getMetricForExperiment(Long experimentId) {
        return flowMetricRepository.findByFlowExperimentExperimentId(experimentId);
    }

    @Override
    public List<FlowMetric> getLatestMetrics() {
        return flowMetricRepository.findLatestMetrics();
    }
}