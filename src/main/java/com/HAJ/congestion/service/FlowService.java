package com.HAJ.congestion.service;

import com.HAJ.congestion.entity.Flow;
import com.HAJ.congestion.entity.FlowMetric;

import java.util.List;

public interface FlowService {

    Flow createFlow(Long experimentId, Flow flow);

    List<Flow> getFlowsByExperiment(Long experimentId);

    Flow getFlowByFlowId(long flowId);
}
