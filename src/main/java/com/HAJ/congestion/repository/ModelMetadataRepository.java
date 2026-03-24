package com.HAJ.congestion.repository;

import com.HAJ.congestion.entity.ModelMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelMetadataRepository extends JpaRepository<ModelMetadata, Long> {
    Optional<ModelMetadata> findTopByOrderByCreationTimeDesc();
}
