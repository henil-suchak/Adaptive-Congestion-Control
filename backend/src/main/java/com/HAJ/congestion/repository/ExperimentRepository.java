package com.HAJ.congestion.repository;

import com.HAJ.congestion.entity.Experiment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExperimentRepository extends JpaRepository<Experiment, Long> {

    List<Experiment> findByUserIdOrUserIdIsNull(Long userId);
    List<Experiment> findByUserId(Long userId);
}
