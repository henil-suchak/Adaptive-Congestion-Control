package com.HAJ.congestion.service;

import com.HAJ.congestion.entity.Experiment;

import java.util.List;

public interface ExperimentService {
   Experiment createExperiment(String Name,String Topology,Double bottleneckBandwidthMbps,Double baseDelayMs,String queueType, Long topologyId);
   void startExperiment(Long experimentId, String modelName);
   void endExperiment(Long experimentId);
   Experiment getExperimentById(Long experimentId);
   List<Experiment> getAllExperiment();
   int getQueuePosition(Long experimentId);
}
