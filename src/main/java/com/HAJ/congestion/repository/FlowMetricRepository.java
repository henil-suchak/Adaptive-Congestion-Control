package com.HAJ.congestion.repository;

import com.HAJ.congestion.entity.FlowMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FlowMetricRepository extends JpaRepository<FlowMetric, Long> {

    List<FlowMetric> findAllByFlowFlowId(Long flowId);

    List<FlowMetric> findByFlowExperimentExperimentId(Long experimentId);

    // ✅ THIS IS REQUIRED
    @Query("""
        SELECT fm
        FROM FlowMetric fm
        ORDER BY fm.timestamp DESC
    """)
    List<FlowMetric> findLatestMetrics();
}