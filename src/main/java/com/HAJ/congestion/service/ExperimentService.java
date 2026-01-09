package com.HAJ.congestion.service;

import com.HAJ.congestion.entity.Experiment;

public interface ExperimentService {
   Experiment createExperiment(String Name,String Topology,Double bottleneckBandwidthMbps,Double baseDelayMs,String queueType);
   void startExperiment(Long experimentId);
   void endExperiment(Long experimentId);
}
