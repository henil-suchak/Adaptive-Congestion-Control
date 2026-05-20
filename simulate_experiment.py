#!/usr/bin/env python3
"""
Simulates a realistic SAC vs CUBIC experiment by posting synthetic metrics
to the Spring Boot backend. Uses realistic congestion control dynamics.
"""
import requests
import time
import math
import random
import sys

BACKEND = "http://localhost:8080/api"

def setup_experiment():
    """Create experiment with dual flows."""
    print("[setup] Creating experiment...")
    r = requests.post(f"{BACKEND}/experiments", json={
        "name": "SAC vs CUBIC — Live Demo Experiment",
        "topology": "dumbbell-dual",
        "bottleneckBandwidthMbps": 2.0,
        "baseDelayMs": 20.0,
        "queueType": "FqCoDel"
    })
    r.raise_for_status()
    exp_id = r.json()["experimentId"]
    print(f"[setup] ✓ Created experiment ID={exp_id}")

    # Start experiment
    requests.post(f"{BACKEND}/experiments/{exp_id}/start").raise_for_status()
    print(f"[setup] ✓ Experiment {exp_id} RUNNING")

    # Create SAC flow
    r = requests.post(f"{BACKEND}/experiments/{exp_id}/flows", json={
        "sender": "10.1.1.1", "receiver": "10.1.3.1",
        "protocol": "TCP-SAC-RL", "algorithmType": "SAC"
    })
    r.raise_for_status()
    sac_flow_id = r.json()["flowId"]
    print(f"[setup] ✓ SAC flow ID={sac_flow_id}")

    # Create CUBIC flow
    r = requests.post(f"{BACKEND}/experiments/{exp_id}/flows", json={
        "sender": "10.1.4.1", "receiver": "10.1.5.1",
        "protocol": "TCP-CUBIC", "algorithmType": "CUBIC"
    })
    r.raise_for_status()
    cubic_flow_id = r.json()["flowId"]
    print(f"[setup] ✓ CUBIC flow ID={cubic_flow_id}")

    return exp_id, sac_flow_id, cubic_flow_id

def simulate_sac_metrics(step, t):
    """SAC agent learns to optimize — smooth, adaptive behavior."""
    # SAC gradually learns optimal cwnd
    phase = min(t / 30.0, 1.0)  # ramp up over 30s

    # RTT: starts higher, SAC learns to reduce it
    base_rtt = 120 - 40 * phase + 10 * math.sin(t * 0.3)
    rtt = max(40, base_rtt + random.gauss(0, 5))

    # Throughput: SAC gradually increases
    base_tput = 0.08 + 0.16 * phase + 0.02 * math.sin(t * 0.2)
    tput = max(0.01, base_tput + random.gauss(0, 0.01))

    # Packet loss: SAC learns to minimize
    loss_rate = max(0, 0.03 - 0.025 * phase + random.gauss(0, 0.005))

    # Cwnd: adaptive, smooth adjustments
    cwnd = 3400 + 6000 * phase + 2000 * math.sin(t * 0.15)
    cwnd = max(340, cwnd)

    # Action factor
    if t < 10:
        action = random.uniform(0.95, 1.15)
    elif t < 30:
        action = random.uniform(0.98, 1.08)
    else:
        action = random.uniform(1.0, 1.05)

    # Reward improves with training
    reward = min(0.9, 0.1 + 0.6 * phase + random.gauss(0, 0.05))

    return {
        "flowId": None,  # set later
        "algorithmType": "SAC",
        "rttMs": round(rtt, 3),
        "throughputMbps": round(tput, 6),
        "packetLossRate": round(loss_rate, 4),
        "cwnd": round(cwnd, 0),
        "sendingRateMbps": round(tput, 6),
        "reward": round(reward, 4),
        "action": round(action, 4)
    }

def simulate_cubic_metrics(step, t):
    """CUBIC: fixed algorithm with characteristic saw-tooth pattern."""
    # CUBIC sawtooth period ~5s
    cycle = (t % 5.0) / 5.0

    # RTT: higher baseline due to queue buildup
    rtt = 80 + 60 * cycle + random.gauss(0, 8)
    if cycle > 0.9:  # loss event
        rtt += 30

    # Throughput: sawtooth with drops
    tput = 0.15 + 0.1 * cycle - (0.08 if cycle > 0.9 else 0)
    tput = max(0.01, tput + random.gauss(0, 0.015))

    # Packet loss: periodic spikes
    loss_rate = 0.001 + (0.05 if cycle > 0.85 else 0) + random.gauss(0, 0.003)
    loss_rate = max(0, loss_rate)

    # Cwnd: classic CUBIC growth
    cwnd = 2000 + 8000 * (cycle ** 3) + random.gauss(0, 200)
    if cycle > 0.9:
        cwnd *= 0.5  # multiplicative decrease
    cwnd = max(340, cwnd)

    return {
        "flowId": None,
        "algorithmType": "CUBIC",
        "rttMs": round(rtt, 3),
        "throughputMbps": round(tput, 6),
        "packetLossRate": round(max(0, loss_rate), 4),
        "cwnd": round(cwnd, 0),
        "sendingRateMbps": round(tput, 6),
        "reward": 0.0,
        "action": 0.0
    }

def main():
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    interval = 0.5  # post every 0.5s

    exp_id, sac_flow_id, cubic_flow_id = setup_experiment()

    print(f"\n{'='*60}")
    print(f"  Running {duration}s experiment (posting every {interval}s)")
    print(f"  Experiment: {exp_id}")
    print(f"  SAC Flow:   {sac_flow_id}")
    print(f"  CUBIC Flow: {cubic_flow_id}")
    print(f"  Dashboard:  http://localhost:3000")
    print(f"{'='*60}\n")

    step = 0
    start = time.time()

    try:
        while (time.time() - start) < duration:
            t = time.time() - start
            step += 1

            # SAC metrics
            sac = simulate_sac_metrics(step, t)
            sac["flowId"] = sac_flow_id
            try:
                requests.post(f"{BACKEND}/metrics", json=sac, timeout=2)
            except Exception as e:
                print(f"[warn] SAC post failed: {e}")

            # CUBIC metrics
            cubic = simulate_cubic_metrics(step, t)
            cubic["flowId"] = cubic_flow_id
            try:
                requests.post(f"{BACKEND}/metrics", json=cubic, timeout=2)
            except Exception as e:
                print(f"[warn] CUBIC post failed: {e}")

            # Dashboard output
            if step % 10 == 0:
                print(f"  Step {step:4d} | t={t:5.1f}s | "
                      f"SAC: RTT={sac['rttMs']:6.1f}ms tput={sac['throughputMbps']:.4f}Mbps R={sac['reward']:+.3f} | "
                      f"CUBIC: RTT={cubic['rttMs']:6.1f}ms tput={cubic['throughputMbps']:.4f}Mbps",
                      flush=True)

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n[info] Interrupted")

    # End experiment
    try:
        requests.post(f"{BACKEND}/experiments/{exp_id}/end", timeout=5)
        print(f"\n[done] Experiment {exp_id} completed ({step} steps)")
    except:
        pass

    # Summary
    print(f"\n{'='*60}")
    print(f"  EXPERIMENT COMPLETE")
    print(f"  Total steps: {step}")
    print(f"  Duration: {time.time()-start:.1f}s")
    print(f"  View results: http://localhost:3000")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
