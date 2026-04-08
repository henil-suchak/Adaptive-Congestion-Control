package com.HAJ.congestion.service;

import com.HAJ.congestion.DTO.ComparisonResult;

public interface ComparisonService {

    ComparisonResult compareFlows(Long experimentId);
}
