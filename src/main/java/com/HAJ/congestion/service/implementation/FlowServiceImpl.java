package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.entity.Experiment;
import com.HAJ.congestion.entity.ExperimentStatus;
import com.HAJ.congestion.entity.Flow;
import com.HAJ.congestion.repository.ExperimentRepository;
import com.HAJ.congestion.repository.FlowRepository;
import com.HAJ.congestion.service.FlowService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class FlowServiceImpl implements FlowService {

    private final FlowRepository flowRepository;
    private final ExperimentRepository experimentRepository;

    public FlowServiceImpl(FlowRepository flowRepository,
                           ExperimentRepository experimentRepository) {
        this.flowRepository = flowRepository;
        this.experimentRepository = experimentRepository;
    }

    @Override
    public Flow createFlow(Long experimentId, Flow flow) {

        System.out.println("[FLOW] createFlow called");
        System.out.println("[FLOW] experimentId = " + experimentId);
        System.out.println("[FLOW] sender = " + flow.getSender());
        System.out.println("[FLOW] receiver = " + flow.getReceiver());
        System.out.println("[FLOW] protocol = " + flow.getProtocol());

        Experiment experiment = experimentRepository.findById(experimentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Experiment not found"
                ));

        if (experiment.getStatus() != ExperimentStatus.RUNNING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Flows can only be created for RUNNING experiments"
            );
        }

        /* ========================
         * VALIDATION (CRITICAL)
         * ======================== */

        if (flow.getSender() == null || flow.getSender().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "sender must be provided"
            );
        }

        if (flow.getReceiver() == null || flow.getReceiver().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "receiver must be provided"
            );
        }

        if (flow.getProtocol() == null || flow.getProtocol().isBlank()) {
            flow.setProtocol("TCP"); // safe default
        }

        /* ========================
         * RELATIONSHIP
         * ======================== */

        flow.setExperiment(experiment);

        Flow saved = flowRepository.save(flow);

        System.out.println("[FLOW] Flow created with ID = " + saved.getFlowId());

        return saved;
    }

    @Override
    public List<Flow> getFlowsByExperiment(Long experimentId) {
        return flowRepository.findByExperiment_ExperimentId(experimentId);
    }

    @Override
    public Flow getFlowByFlowId(long flowId) {
        return flowRepository.findByFlowId(flowId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Flow not found"
                ));
    }
}