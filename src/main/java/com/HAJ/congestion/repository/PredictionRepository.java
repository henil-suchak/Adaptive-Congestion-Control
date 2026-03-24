package com.HAJ.congestion.repository;

import com.HAJ.congestion.entity.ModelMetadata;
import com.HAJ.congestion.entity.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PredictionRepository extends JpaRepository<Prediction,Long> {
    Optional<Prediction> findTopByOrderByTimestampDesc();
}
