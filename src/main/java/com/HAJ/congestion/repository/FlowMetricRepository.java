package com.HAJ.congestion.repository;

import com.HAJ.congestion.entity.FlowMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FlowMetricRepository extends JpaRepository<FlowMetric,Long> {
}
