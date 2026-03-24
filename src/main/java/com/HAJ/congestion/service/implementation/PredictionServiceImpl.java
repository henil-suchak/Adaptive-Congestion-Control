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

    private final DummyCongestionModel dummyCongestionModel;
    private final PredictionRepository predictionRepository;
    private final ModelMetadataRepository modelMetadataRepository;

    public PredictionServiceImpl(DummyCongestionModel dummyCongestionModel,
                                 PredictionRepository predictionRepository,
                                 ModelMetadataRepository modelMetadataRepository) {
        this.dummyCongestionModel = dummyCongestionModel;
        this.predictionRepository = predictionRepository;
        this.modelMetadataRepository = modelMetadataRepository;
    }

    @Override
    public Prediction generateAndSavePrediction(FlowMetric flowMetric) {

        // Step 1: Run dummy ML model
        PredictionResult result = dummyCongestionModel.predict(flowMetric);

        // Step 2: Ensure model metadata exists (AUTO REGISTER)
        ModelMetadata modelMetadata =
                modelMetadataRepository.findTopByOrderByCreationTimeDesc()
                        .orElseGet(() -> {
                            ModelMetadata dummyModel = new ModelMetadata(
                                    "v1.0",
                                    "dummy-dataset.csv",
                                    0.75,
                                    LocalDateTime.now()
                            );
                            return modelMetadataRepository.save(dummyModel);
                        });

        // Step 3: Save prediction
        Prediction prediction = new Prediction(
                result.getPredictionRateMbps(),
                result.getConfidence(),
                LocalDateTime.now(),
                flowMetric.getFlow(),
                modelMetadata
        );

        return predictionRepository.save(prediction);
    }
}
