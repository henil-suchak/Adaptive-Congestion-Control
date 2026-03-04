package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.ML.DummyCongestionModel;
import com.HAJ.congestion.ML.PredictionResult;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.entity.ModelMetadata;
import com.HAJ.congestion.entity.Prediction;
import com.HAJ.congestion.repository.ModelMetadataRepository;
import com.HAJ.congestion.repository.PredictionRepository;
import com.HAJ.congestion.service.PredictionService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
@Service
public class PredictionServiceImpl implements PredictionService {
    private final MlClientService mlClientService;
    private  final PredictionRepository predictionRepository;
    private final ModelMetadataRepository modelMetadataRepository;

    public PredictionServiceImpl(DummyCongestionModel dummyCongestionModel, MlClientService mlClientService, PredictionRepository predictionRepository, ModelMetadataRepository modelMetadataRepository){
        this.mlClientService = mlClientService;
        this.predictionRepository=predictionRepository;
        this.modelMetadataRepository=modelMetadataRepository;
    }
    @Override
    public double generateAndSavePrediction(FlowMetric flowMetric) {

        // 1️⃣ Call ML server
        PredictionResult predictionResult = mlClientService.callMlModel(flowMetric);

        // 2️⃣ Get latest registered model
        ModelMetadata modelMetadata = modelMetadataRepository
                .findTopByOrderByCreatedAtDesc()
                .orElseThrow(() -> new IllegalStateException("No ML Model Registered."));

        // 3️⃣ Create Prediction entity
        Prediction prediction = new Prediction(
                predictionResult.getPredictionRateMbps(),
                predictionResult.getConfidence(),
                LocalDateTime.now(),
                flowMetric.getFlow(),
                modelMetadata
        );

        // 4️⃣ Save prediction
        predictionRepository.save(prediction);

        // 5️⃣ RETURN predicted rate (important)
        return predictionResult.getPredictionRateMbps();
    }
}
