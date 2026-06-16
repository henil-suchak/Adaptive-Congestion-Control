import re

with open('ns3_files/sim_server/services/inference_svc.py', 'r') as f:
    content = f.read()

# We will completely overwrite everything from "# ── Step 8: Inference loop" down to the end of _inference_worker
start_marker = "# ── Step 8:"
end_marker = "def run_inference_loop"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

new_loop_code = """# ── Step 8: Inference loop ─────────────────────────────────────────────
        step_counter = 0
        print("📈 [Worker] Starting inference loop...", flush=True)

        while True:
            # Check for stop signal or C++ process death
            if not _inference_state["busy"]:
                print("🛑 [Inference] Stop signal received.", flush=True)
                break
            if process.poll() is not None:
                print("🏁 [Worker] C++ process ended.", flush=True)
                break

            with agent as data:
                if data is None or agent.isFinish():
                    break

                step_counter += 1
                num_agents = data.env.numAgents
                if num_agents == 0:
                    continue

                obs_shape = model.observation_space.shape[0] if hasattr(model.observation_space, 'shape') else 6
                
                if obs_shape >= 60:
                    flat_obs = np.zeros(60, dtype=np.float32)
                    for i in range(10):
                        if i < num_agents:
                            seg_size = max(data.env.segmentSize[i], 340)
                            raw_obs = np.array([
                                data.env.cWnd[i], data.env.rtt_us[i], data.env.throughput[i],
                                data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                            ], dtype=np.float32)
                            flat_obs[i*6:(i+1)*6] = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                    
                    actions, _ = model.predict(flat_obs, deterministic=True)
                    
                    for i in range(num_agents):
                        seg_size = max(data.env.segmentSize[i], 340)
                        
                        act_low = float(model.action_space.low[0]) if hasattr(model.action_space, 'low') else 0.5
                        act_high = float(model.action_space.high[0]) if hasattr(model.action_space, 'high') else 2.0
                        factor = float(np.clip(actions[i], act_low, act_high))
                        
                        # Add a small heuristic boost if we are stuck at minimum window with a "keep" factor
                        cWnd = data.env.cWnd[i]
                        if cWnd <= seg_size and factor >= 1.0:
                            factor = max(factor, 1.5) # Force jump out of the 1-segment trap
                            
                        MAX_CWND = seg_size * 1000
                        new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                        new_ssThresh = int(new_cWnd * 0.75) if factor < 1.0 else min(int(new_cWnd * 2), MAX_CWND * 2)
                        data.act.new_cWnd[i] = new_cWnd
                        data.act.new_ssThresh[i] = new_ssThresh
                        
                else:
                    # LEGACY Single-agent model (expects 6 features, returns 1 action)
                    for i in range(num_agents):
                        cWnd = data.env.cWnd[i]
                        seg_size = max(data.env.segmentSize[i], 340)
                        raw_obs = np.array([
                            cWnd, data.env.rtt_us[i], data.env.throughput[i],
                            data.env.packetLoss[i], seg_size, data.env.bytesInFlight[i]
                        ], dtype=np.float32)
                        normalized_obs = np.clip(raw_obs / OBS_MAX, 0.0, 1.0)
                        action, _ = model.predict(normalized_obs, deterministic=True)
                        
                        act_low = float(model.action_space.low[0]) if hasattr(model.action_space, 'low') else 0.5
                        act_high = float(model.action_space.high[0]) if hasattr(model.action_space, 'high') else 2.0
                        raw_factor = action[0] if isinstance(action, np.ndarray) else action
                        factor = float(np.clip(raw_factor, act_low, act_high))
                        
                        if cWnd <= seg_size and factor >= 1.0:
                            factor = max(factor, 1.5)
                            
                        MAX_CWND = seg_size * 1000
                        new_cWnd = int(np.clip(cWnd * factor, seg_size, MAX_CWND))
                        new_ssThresh = int(new_cWnd * 0.75) if factor < 1.0 else min(int(new_cWnd * 2), MAX_CWND * 2)
                        data.act.new_cWnd[i] = new_cWnd
                        data.act.new_ssThresh[i] = new_ssThresh

                # Debug first 3 steps
                if step_counter <= 3:
                    print(f"   [Step {step_counter}] num_agents={num_agents} cWnd[0]={data.env.cWnd[0]} -> new_cWnd[0]={data.act.new_cWnd[0]}", flush=True)

                if step_counter % 20 == 0:
                    sim_time_sec = round(step_counter * 0.040, 3)
                    payload = {
                        "experimentId":   experiment_id,
                        "cwndBytes":      float(data.env.cWnd[0]),
                        "ssThresh":       float(data.act.new_ssThresh[0]),
                        "rttMs":          float(data.env.rtt_us[0] / 1000.0),
                        "throughputMbps": float((data.env.throughput[0] * 8) / 1_000_000.0),
                        "packetLossRate": float(data.env.packetLoss[0]),
                        "simTimeSec":     sim_time_sec
                    }
                    print(
                        f"📊 [Step {step_counter}] TELEMETRY → backend  "
                        f"expId={payload['experimentId']}  "
                        f"cwnd={payload['cwndBytes']:.0f}B  "
                        f"ssThresh={payload['ssThresh']:.0f}  "
                        f"rtt={payload['rttMs']:.2f}ms  "
                        f"tput={payload['throughputMbps']:.4f}Mbps  "
                        f"loss={payload['packetLossRate']:.0f}  "
                        f"simTime={sim_time_sec:.1f}s",
                        flush=True
                    )
                    sender.enqueue(payload)

        print(f"🏁 [Worker] Experiment {experiment_id} finished cleanly!", flush=True)

    except Exception as e:
        print(f"❌ [Worker] Loop crashed: {e}", flush=True)
        import traceback
        traceback.print_exc()
    finally:
        # Shut down telemetry sender (closes WebSocket, drains queue)
        sender.stop()
        # Kill C++ if still running
        kill_cpp_binary(experiment_id)
        _shm_cleanup()
        print(f"🧹 [Worker] Final cleanup done for Exp {experiment_id}.", flush=True)


"""

new_content = content[:start_idx] + new_loop_code + content[end_idx:]

# Also fix the OBS_MAX directly
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

new_obs_max = """        # Calculate dynamic normalization bounds based on topology (MUST MATCH env_wrapper.py EXACTLY)
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

new_content = new_content.replace(old_obs_max, new_obs_max)

with open('ns3_files/sim_server/services/inference_svc.py', 'w') as f:
    f.write(new_content)
