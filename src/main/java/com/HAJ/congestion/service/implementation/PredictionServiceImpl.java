package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.ML.DummyCongestionModel;
import com.HAJ.congestion.ML.PredictionResult;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.entity.ModelMetadata;
import com.HAJ.congestion.entity.Prediction;
import com.HAJ.congestion.repository.ModelMetadataRepository;
import com.HAJ.congestion.repository.PredictionRepository;
import com.HAJ.congestion.service.PredictionService;

import java.time.LocalDateTime;

public class PredictionServiceImpl implements PredictionService {
    private final DummyCongestionModel dummyCongestionModel;
    private  final PredictionRepository predictionRepository;
    private final ModelMetadataRepository modelMetadataRepository;

    public PredictionServiceImpl(DummyCongestionModel dummyCongestionModel,PredictionRepository predictionRepository,ModelMetadataRepository modelMetadataRepository){
        this.dummyCongestionModel=dummyCongestionModel;
        this.predictionRepository=predictionRepository;
        this.modelMetadataRepository=modelMetadataRepository;
    }
    @Override
    public Prediction generateAndSavePrediction(FlowMetric flowMetric){
        PredictionResult predictionResult = dummyCongestionModel.predict(flowMetric);

        ModelMetadata modelMetadata = modelMetadataRepository.findTopByOrderByCreatedAtDesc().orElseThrow(()-> new IllegalStateException("No ML Model Registerd."));

        Prediction prediction= new Prediction(
                predictionResult.getPredictionRateMbps(),
                predictionResult.getConfidence(),
                LocalDateTime.now(),
                flowMetric.getFlow(),
                modelMetadata
        );

        return predictionRepository.save(prediction);
    }
}
