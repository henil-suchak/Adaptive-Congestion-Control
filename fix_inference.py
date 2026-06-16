import re
with open('ns3_files/sim_server/services/inference_svc.py', 'r') as f:
    content = f.read()

# 1. Fix OBS_MAX calculation
old_obs_max = """        # Calculate dynamic normalization bounds based on topology (matches env_wrapper.py)
        bottleneck_bps = float(bandwidth) * 1_000_000.0
        access_bps     = float(access_bw) * 1_000_000.0
        max_bps        = max(bottleneck_bps, access_bps)
        
        OBS_MAX = np.array([
            max_bps * 0.1,  # cWnd max (bytes)
            500_000.0,      # RTT max (us)
            max_bps / 8.0,  # Throughput max (bytes/sec)
            100.0,          # Packet loss max
            1_500.0,        # Segment size max
            max_bps * 0.1   # Bytes in flight max
        ], dtype=np.float32)"""

new_obs_max = """        # Calculate dynamic normalization bounds based on topology (MUST MATCH env_wrapper.py)
        bottleneck_bps = float(bandwidth) * 1_000_000.0
        access_bps     = float(access_bw) * 1_000_000.0
        bottle_delay_s = float(delay) / 1000.0
        access_delay_s = float(access_delay) / 1000.0

        TMAX = bottleneck_bps / 8.0
        RTT_MIN_S = 2.0 * (bottle_delay_s + 2.0 * access_delay_s)
        RTT_MIN_US = RTT_MIN_S * 1_000_000.0
        BDP_BYTES = TMAX * RTT_MIN_S

        MAX_CWND_BYTES = max(BDP_BYTES * 5.0, 1500.0 * 100.0)
        MAX_RTT_US = max(RTT_MIN_US * 10.0, 200_000.0)
        
        OBS_MAX = np.array([
            MAX_CWND_BYTES,  # cWnd max (bytes)
            MAX_RTT_US,      # RTT max (us)
            TMAX * 2.0,      # Throughput max (bytes/sec)
            100.0,           # Packet loss max
            1_500.0,         # Segment size max
            MAX_CWND_BYTES   # Bytes in flight max
        ], dtype=np.float32)"""

content = content.replace(old_obs_max, new_obs_max)

# 2. Fix the action multiplier inside _run_agent_loop
old_agent_loop = """                            actions, _ = model.predict(flat_obs, deterministic=True)
                            for i in range(10):
                                if i < num_agents:
                                    data.act.new_cWnd[i] = max(1, int(actions[i] * 10000))
                        else:
                            for i in range(num_agents):
                                seg_size = max(data.env.segmentSize[i], 340)
                                raw_obs = np.array([
                                    data.env.cWnd[i], data.env.rtt_us[i], data.env.throughput[i],
                                    data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                                ], dtype=np.float32)
                                norm_obs = np.clip(raw_obs / obs_max, 0.0, 1.0)
                                action, _ = model.predict(norm_obs, deterministic=True)
                                data.act.new_cWnd[i] = max(1, int(action[0] * 10000))"""

new_agent_loop = """                            actions, _ = model.predict(flat_obs, deterministic=True)
                            for i in range(10):
                                if i < num_agents:
                                    factor = float(actions[i])
                                    cWnd = data.env.cWnd[i]
                                    seg_size = max(data.env.segmentSize[i], 340)
                                    MAX_CWND = max(5000000, seg_size * 10)
                                    new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                                    data.act.new_cWnd[i] = new_cWnd
                                    if factor < 1.0:
                                        data.act.new_ssThresh[i] = int(new_cWnd * 0.75)
                                    else:
                                        data.act.new_ssThresh[i] = min(int(new_cWnd * 2), MAX_CWND * 2)
                        else:
                            for i in range(num_agents):
                                seg_size = max(data.env.segmentSize[i], 340)
                                raw_obs = np.array([
                                    data.env.cWnd[i], data.env.rtt_us[i], data.env.throughput[i],
                                    data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                                ], dtype=np.float32)
                                norm_obs = np.clip(raw_obs / obs_max, 0.0, 1.0)
                                action, _ = model.predict(norm_obs, deterministic=True)
                                factor = float(action[0])
                                cWnd = data.env.cWnd[i]
                                MAX_CWND = max(5000000, seg_size * 10)
                                new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                                data.act.new_cWnd[i] = new_cWnd
                                if factor < 1.0:
                                    data.act.new_ssThresh[i] = int(new_cWnd * 0.75)
                                else:
                                    data.act.new_ssThresh[i] = min(int(new_cWnd * 2), MAX_CWND * 2)"""

content = content.replace(old_agent_loop, new_agent_loop)

# 3. Fix the action multiplier inside the telemetry loop (if any)
# Wait, let's just make sure we replace the legacy logic in the telemetry block too!
old_legacy_telemetry = """                        normalized_obs = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                        action, _ = model.predict(normalized_obs, deterministic=True)
                        
                        act_low = float(model.action_space.low[0]) if hasattr(model.action_space, 'low') else 0.5
                        act_high = float(model.action_space.high[0]) if hasattr(model.action_space, 'high') else 2.0
                        raw_factor = action[0] if isinstance(action, np.ndarray) else action
                        factor = float(np.clip(raw_factor, act_low, act_high))
                        
                        MAX_CWND = seg_size * 1000
                        new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))"""

new_legacy_telemetry = """                        normalized_obs = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                        action, _ = model.predict(normalized_obs, deterministic=True)
                        
                        factor = float(action[0])
                        MAX_CWND = seg_size * 1000
                        new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))"""

content = content.replace(old_legacy_telemetry, new_legacy_telemetry)

with open('ns3_files/sim_server/services/inference_svc.py', 'w') as f:
    f.write(content)
