package com.HAJ.congestion.repository;

import com.HAJ.congestion.entity.Flow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FlowRepository extends JpaRepository<Flow, Long> {

    List<Flow> findByExperiment_ExperimentId(Long experimentId);

    Optional<Flow> findByFlowId(String flowId);
}
