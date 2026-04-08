package com.HAJ.congestion.controller;

import com.HAJ.congestion.DTO.ComparisonResult;
import com.HAJ.congestion.service.ComparisonService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
public class ComparisonController {

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    @GetMapping("/experiments/{experimentId}/compare")
    public ComparisonResult compareFlows(@PathVariable Long experimentId) {
        return comparisonService.compareFlows(experimentId);
    }
}
