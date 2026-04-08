package com.HAJ.congestion.service.implementation;

import com.HAJ.congestion.DTO.ComparisonResult;
import com.HAJ.congestion.DTO.ComparisonResult.AlgorithmStats;
import com.HAJ.congestion.DTO.ComparisonResult.ImprovementPct;
import com.HAJ.congestion.entity.Flow;
import com.HAJ.congestion.entity.FlowMetric;
import com.HAJ.congestion.repository.FlowMetricRepository;
import com.HAJ.congestion.repository.FlowRepository;
import com.HAJ.congestion.service.ComparisonService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ComparisonServiceImpl implements ComparisonService {

    private final FlowRepository flowRepository;
    private final FlowMetricRepository flowMetricRepository;

    // Weighted scoring: higher throughput is better, lower RTT and loss are better
    private static final double W_THROUGHPUT = 0.45;
    private static final double W_RTT       = 0.35;
    private static final double W_LOSS      = 0.20;

    public ComparisonServiceImpl(FlowRepository flowRepository,
                                 FlowMetricRepository flowMetricRepository) {
        this.flowRepository = flowRepository;
        this.flowMetricRepository = flowMetricRepository;
    }

    @Override
    public ComparisonResult compareFlows(Long experimentId) {
        Flow sacFlow = flowRepository
                .findByExperiment_ExperimentIdAndAlgorithmType(experimentId, "SAC")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "SAC flow not found for experiment " + experimentId));

        Flow cubicFlow = flowRepository
                .findByExperiment_ExperimentIdAndAlgorithmType(experimentId, "CUBIC")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "CUBIC flow not found for experiment " + experimentId));

        List<FlowMetric> sacMetrics = flowMetricRepository.findAllByFlowFlowId(sacFlow.getFlowId());
        List<FlowMetric> cubicMetrics = flowMetricRepository.findAllByFlowFlowId(cubicFlow.getFlowId());

        AlgorithmStats sacStats = computeStats(sacMetrics);
        AlgorithmStats cubicStats = computeStats(cubicMetrics);

        double sacScore = computeScore(sacStats, cubicStats, true);
        double cubicScore = computeScore(cubicStats, sacStats, false);

        String winner = sacScore >= cubicScore ? "SAC" : "CUBIC";
        ImprovementPct improvement = computeImprovement(sacStats, cubicStats);

        return new ComparisonResult(sacStats, cubicStats, winner, sacScore, cubicScore, improvement);
    }

    private AlgorithmStats computeStats(List<FlowMetric> metrics) {
        if (metrics.isEmpty()) {
            return new AlgorithmStats(0, 0, 0, 0, 0);
        }

        double sumRtt = 0, sumTput = 0, sumCwnd = 0, sumLoss = 0;
        for (FlowMetric m : metrics) {
            sumRtt  += safe(m.getRttMs());
            sumTput += safe(m.getThroughputMbps());
            sumCwnd += safe(m.getCwndBytes());
            sumLoss += safe(m.getPacketLossRate());
        }
        int n = metrics.size();
        return new AlgorithmStats(
                round4(sumRtt / n),
                round4(sumTput / n),
                round4(sumCwnd / n),
                round4(sumLoss / n),
                n
        );
    }

    /**
     * Weighted score: normalize each metric against the opponent and combine.
     * throughput: higher is better → ratio = mine / max(theirs, epsilon)
     * rtt: lower is better        → ratio = min(theirs, mine*2) / max(mine, epsilon)
     * loss: lower is better       → ratio = (1 - myLoss) / max(1 - theirLoss, epsilon)
     */
    private double computeScore(AlgorithmStats mine, AlgorithmStats theirs,
                                @SuppressWarnings("unused") boolean isSac) {
        double eps = 1e-9;
        double maxTput = Math.max(mine.getAvgThroughputMbps(), theirs.getAvgThroughputMbps());
        double tputScore = maxTput > eps ? mine.getAvgThroughputMbps() / maxTput : 0.5;

        double minRtt = Math.min(mine.getAvgRttMs(), theirs.getAvgRttMs());
        double rttScore = mine.getAvgRttMs() > eps ? Math.min(minRtt / mine.getAvgRttMs(), 1.0) : 0.5;

        double myGoodput  = 1.0 - Math.min(mine.getAvgPacketLossRate(), 1.0);
        double thGoodput  = 1.0 - Math.min(theirs.getAvgPacketLossRate(), 1.0);
        double maxGoodput = Math.max(myGoodput, thGoodput);
        double lossScore  = maxGoodput > eps ? myGoodput / maxGoodput : 0.5;

        return round4(W_THROUGHPUT * tputScore + W_RTT * rttScore + W_LOSS * lossScore);
    }

    private ImprovementPct computeImprovement(AlgorithmStats sac, AlgorithmStats cubic) {
        double eps = 1e-9;
        // RTT: lower is better → negative improvement means SAC has lower RTT (good)
        double rttPct = cubic.getAvgRttMs() > eps
                ? round4(((cubic.getAvgRttMs() - sac.getAvgRttMs()) / cubic.getAvgRttMs()) * 100.0)
                : 0.0;

        // Throughput: higher is better → positive means SAC is higher (good)
        double tputPct = cubic.getAvgThroughputMbps() > eps
                ? round4(((sac.getAvgThroughputMbps() - cubic.getAvgThroughputMbps()) / cubic.getAvgThroughputMbps()) * 100.0)
                : 0.0;

        // Loss: lower is better → positive means SAC has lower loss (good)
        double lossPct = cubic.getAvgPacketLossRate() > eps
                ? round4(((cubic.getAvgPacketLossRate() - sac.getAvgPacketLossRate()) / cubic.getAvgPacketLossRate()) * 100.0)
                : 0.0;

        return new ImprovementPct(rttPct, tputPct, lossPct);
    }

    private static double safe(Double v) { return v != null ? v : 0.0; }
    private static double round4(double v) { return Math.round(v * 10000.0) / 10000.0; }
}
