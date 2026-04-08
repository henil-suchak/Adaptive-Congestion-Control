package com.HAJ.congestion.DTO;

/**
 * DTO returned by the comparison API.
 * Contains per-algorithm averages, the winner, and improvement percentages.
 */
public class ComparisonResult {

    private AlgorithmStats sac;
    private AlgorithmStats cubic;
    private String winner;
    private double sacScore;
    private double cubicScore;
    private ImprovementPct improvement;

    public ComparisonResult() {}

    public ComparisonResult(AlgorithmStats sac, AlgorithmStats cubic,
                            String winner, double sacScore, double cubicScore,
                            ImprovementPct improvement) {
        this.sac = sac;
        this.cubic = cubic;
        this.winner = winner;
        this.sacScore = sacScore;
        this.cubicScore = cubicScore;
        this.improvement = improvement;
    }

    public AlgorithmStats getSac() { return sac; }
    public AlgorithmStats getCubic() { return cubic; }
    public String getWinner() { return winner; }
    public double getSacScore() { return sacScore; }
    public double getCubicScore() { return cubicScore; }
    public ImprovementPct getImprovement() { return improvement; }

    /**
     * Aggregated statistics for one algorithm.
     */
    public static class AlgorithmStats {
        private double avgRttMs;
        private double avgThroughputMbps;
        private double avgCwndBytes;
        private double avgPacketLossRate;
        private long sampleCount;

        public AlgorithmStats() {}

        public AlgorithmStats(double avgRttMs, double avgThroughputMbps,
                              double avgCwndBytes, double avgPacketLossRate,
                              long sampleCount) {
            this.avgRttMs = avgRttMs;
            this.avgThroughputMbps = avgThroughputMbps;
            this.avgCwndBytes = avgCwndBytes;
            this.avgPacketLossRate = avgPacketLossRate;
            this.sampleCount = sampleCount;
        }

        public double getAvgRttMs() { return avgRttMs; }
        public double getAvgThroughputMbps() { return avgThroughputMbps; }
        public double getAvgCwndBytes() { return avgCwndBytes; }
        public double getAvgPacketLossRate() { return avgPacketLossRate; }
        public long getSampleCount() { return sampleCount; }
    }

    /**
     * Improvement percentages (SAC relative to CUBIC).
     * Positive = SAC is better, Negative = CUBIC is better.
     */
    public static class ImprovementPct {
        private double rttPct;
        private double throughputPct;
        private double lossPct;

        public ImprovementPct() {}

        public ImprovementPct(double rttPct, double throughputPct, double lossPct) {
            this.rttPct = rttPct;
            this.throughputPct = throughputPct;
            this.lossPct = lossPct;
        }

        public double getRttPct() { return rttPct; }
        public double getThroughputPct() { return throughputPct; }
        public double getLossPct() { return lossPct; }
    }
}
