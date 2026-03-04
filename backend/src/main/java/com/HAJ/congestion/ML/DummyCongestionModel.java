package com.HAJ.congestion.ML;

import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.entity.Prediction;
import org.springframework.stereotype.Component;

@Component
public class DummyCongestionModel {
    public  PredictionResult predict(FlowMetric flowMetric){
        double recomendedRate;
        double confidence;

        if(flowMetric.getPacketLossRate()>0.05){
            recomendedRate=flowMetric.getSendingRateMbps()*0.7;
            confidence=0.85;
        }else if(flowMetric.getRttMs()>150){
            recomendedRate = flowMetric.getSendingRateMbps()*0.8;
            confidence=0.75;
        }else{
            recomendedRate=flowMetric.getSendingRateMbps()*1.06;
            confidence=0.65;
        }
        return new PredictionResult(recomendedRate,confidence);
    }
}
