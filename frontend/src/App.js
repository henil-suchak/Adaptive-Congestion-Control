import React, { useState, useMemo } from 'react';
import TabNav from './components/TabNav';
import SACPage from './components/SACPage';
import CubicPage from './components/CubicPage';
import ComparisonPage from './components/ComparisonPage';
import GuidedTour from './components/GuidedTour';
import { useMetricsWebSocket } from './hooks/useMetricsWebSocket';
import './index.css';

/**
 * Per-tab tour definitions. Each step references a DOM id that the
 * corresponding page renders via `id="tour-..."` on a wrapper element.
 */
const TOURS = {
  SAC: [
    { anchorId: 'tour-sac-agent',      title: 'SAC Agent',
      body: 'This panel shows the last action the SAC agent chose (how it scaled cWnd) and the reward it received for it.' },
    { anchorId: 'tour-sac-rtt',        title: 'RTT Graph',
      body: 'Round-trip time over time. A rising RTT means packets are queuing at the bottleneck — a sign of congestion.' },
    { anchorId: 'tour-sac-throughput', title: 'Throughput Graph',
      body: 'The useful data rate. SAC\'s goal is to push this close to 2 Mbps while keeping RTT and loss low.' },
    { anchorId: 'tour-sac-cwnd',       title: 'cWnd Graph',
      body: 'The congestion window is the knob SAC moves each step. Its shape reveals how the learned policy is probing the link.' },
    { anchorId: 'tour-sac-reward',     title: 'Reward Signal',
      body: 'Scalar feedback the agent uses to learn. Higher-on-average reward means the policy is improving.' },
  ],
  CUBIC: [
    { anchorId: 'tour-cubic-phases',    title: 'Three Phases',
      body: 'CUBIC cycles through Slow Start, Congestion Avoidance, and Loss Recovery. Read these first to anchor everything else.' },
    { anchorId: 'tour-cubic-topology',  title: 'Network Topology',
      body: 'The simulated path. The 2 Mbps bottleneck link is where congestion actually happens.' },
    { anchorId: 'tour-cubic-cwnd',      title: 'cWnd Phase View',
      body: 'The cWnd graph with phases auto-labelled. Look for the classic sawtooth shape and colour-coded regions.' },
    { anchorId: 'tour-cubic-rtt',       title: 'RTT Graph',
      body: 'CUBIC tends to keep pushing until loss — watch for RTT climbing as queues fill before each drop.' },
    { anchorId: 'tour-cubic-throughput', title: 'Throughput Graph',
      body: 'Aggressive probing gives CUBIC high average throughput, but the cost is visible here as periodic dips after losses.' },
  ],
  COMPARE: [
    { anchorId: 'tour-compare-banner',   title: 'Performance Comparison',
      body: 'This view is framed as a trade-off explorer, not a contest — use it to see how the two algorithms differ per metric.' },
    { anchorId: 'tour-compare-takeaways', title: 'Key Takeaways',
      body: 'Short, data-driven observations derived from the current live averages. They update as new samples arrive.' },
    { anchorId: 'tour-compare-personas',  title: 'Algorithm Personalities',
      body: 'A quick-read summary of each algorithm\'s character: rule-based & aggressive vs learning-based & stable.' },
  ],
};

function App() {
  const [tab, setTab] = useState('SAC');
  const [learningMode, setLearningMode] = useState(true);
  const [tourActive, setTourActive] = useState(false);

  const {
    sacMetrics,
    cubicMetrics,
    sacCurrent,
    cubicCurrent,
    sacStepCount,
    cubicStepCount,
    connected,
  } = useMetricsWebSocket();

  const tourSteps = useMemo(() => TOURS[tab] || [], [tab]);

  const handleTabChange = (t) => {
    setTab(t);
    setTourActive(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TabNav
        active={tab}
        onChange={handleTabChange}
        connected={connected}
        learningMode={learningMode}
        onToggleLearning={setLearningMode}
        canStartTour={tourSteps.length > 0}
        onStartTour={() => setTourActive(true)}
      />

      {/* All pages stay mounted so live data isn't reset on tab switch. */}
      <div className={tab === 'SAC' ? '' : 'hidden'}>
        <SACPage
          sacMetrics={sacMetrics}
          cubicMetrics={cubicMetrics}
          sacCurrent={sacCurrent}
          sacStepCount={sacStepCount}
          learningMode={learningMode}
        />
      </div>

      <div className={tab === 'CUBIC' ? '' : 'hidden'}>
        <CubicPage
          cubicMetrics={cubicMetrics}
          cubicCurrent={cubicCurrent}
          cubicStepCount={cubicStepCount}
          learningMode={learningMode}
        />
      </div>

      <div className={tab === 'COMPARE' ? '' : 'hidden'}>
        <ComparisonPage
          sacMetrics={sacMetrics}
          cubicMetrics={cubicMetrics}
          learningMode={learningMode}
        />
      </div>

      <GuidedTour
        active={tourActive}
        steps={tourSteps}
        onClose={() => setTourActive(false)}
      />
    </div>
  );
}

export default App;
