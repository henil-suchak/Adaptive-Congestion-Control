package com.HAJ.congestion.DTO;

public class CongestionDecisionResponse {
    private String action;
    private double recommendedRate;

    public CongestionDecisionResponse(String action, double recommendedRate) {
        this.action = action;
        this.recommendedRate = recommendedRate;
    }

    public String getAction() {
        return action;
    }

    public double getRecommendedRate() {
        return recommendedRate;
    }

}
