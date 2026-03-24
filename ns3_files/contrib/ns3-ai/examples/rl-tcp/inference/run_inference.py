#!/usr/bin/env python3
import argparse, subprocess, time, sys, os, signal
import numpy as np
import threading
from collections import deque
from datetime import datetime

NS3_ROOT   = '/Users/suchak/CongestionControl/ns-allinone-3.35/ns-3.35'
BINARY     = os.path.join(NS3_ROOT, 'build/scratch/rl-tcp-inference/rl-tcp-inference')
SEG_SIZE   = 340
BDP        = 10_000.0
RTT_MIN_US = 40_020.0
TMAX       = 250_000.0
SHM_ID     = 2333
SHM_SIZE   = 4096
OBS_MAX    = np.array([1_400_000.0,200_000.0,250_000.0,100.0,1_500.0,1_400_000.0],dtype=np.float32)

sys.path.insert(0, os.path.join(NS3_ROOT, 'contrib/ns3-ai/py_interface'))
sys.path.insert(0, os.path.join(NS3_ROOT, 'contrib/ns3-ai/examples/rl-tcp/inference'))

# ── Rolling history for summary stats ────────────────────────────────────────
HISTORY = 100
rtt_hist    = deque(maxlen=HISTORY)
tput_hist   = deque(maxlen=HISTORY)
cwnd_hist   = deque(maxlen=HISTORY)
reward_hist = deque(maxlen=HISTORY)
action_hist = deque(maxlen=HISTORY)
loss_hist   = deque(maxlen=HISTORY)


# ── Backend Lifecycle Manager ────────────────────────────────────────────────

class BackendManager:
    """Manages the complete Spring Boot backend lifecycle:
       setup() → post_metric() × N → teardown()
    """

    def __init__(self, base_url="http://localhost:8080/api"):
        self.base_url = base_url
        self.experiment_id = None
        self.flow_id = None
        self.available = True
        self._session = None

    def _get_session(self):
        if self._session is None:
            import requests
            self._session = requests.Session()
        return self._session

    def setup(self, model_path, duration):
        """Called ONCE at inference start.
        1. POST /api/experiments → get experiment_id
        2. POST /api/experiments/{id}/start → set RUNNING
        3. POST /api/experiments/{id}/flows → get flow_id
        """
        if not self.available:
            return

        try:
            s = self._get_session()
            model_name = os.path.basename(model_path)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            exp_name = f"SAC Inference — {model_name} @ {ts}"

            # 1. Create experiment
            r = s.post(f"{self.base_url}/experiments", json={
                "name": exp_name,
                "topology": "dumbbell",
                "bottleneckBandwidthMbps": 2.0,
                "baseDelayMs": 20.0,
                "queueType": "FqCoDel"
            }, timeout=5.0)
            r.raise_for_status()
            self.experiment_id = r.json()["experimentId"]
            print(f"[backend] experiment created id={self.experiment_id}  "
                  f"name=\"{exp_name}\"", flush=True)

            # 2. Start experiment
            r = s.post(f"{self.base_url}/experiments/{self.experiment_id}/start",
                       timeout=5.0)
            r.raise_for_status()
            print(f"[backend] experiment {self.experiment_id} → RUNNING", flush=True)

            # 3. Create flow
            r = s.post(f"{self.base_url}/experiments/{self.experiment_id}/flows",
                       json={
                           "sender": "10.1.1.1",
                           "receiver": "10.1.3.1",
                           "protocol": "TCP-SAC-RL"
                       }, timeout=5.0)
            r.raise_for_status()
            self.flow_id = r.json()["flowId"]
            print(f"[backend] flow created id={self.flow_id}  "
                  f"(experiment={self.experiment_id})", flush=True)

        except Exception as e:
            self.available = False
            print(f"[backend] setup failed: {e} — continuing without backend",
                  flush=True)

    def post_metric(self, env, reward, action_factor):
        """Fire-and-forget POST to /api/metrics in background thread."""
        if not self.available or self.flow_id is None:
            return

        payload = {
            "flowId": self.flow_id,
            "rttMs": round(env['rtt_us'] / 1000.0, 3),
            "throughputMbps": round(env['throughput'] / 1e6, 6),
            "packetLossRate": round(float(env['packetLoss']) / 100.0, 4),
            "cwnd": float(env['cWnd']),
            "sendingRateMbps": round(env['throughput'] / 1e6, 6),
            "reward": round(float(reward), 4),
            "action": round(float(action_factor), 4)
        }

        def _post():
            try:
                s = self._get_session()
                r = s.post(f"{self.base_url}/metrics", json=payload, timeout=2.0)
                if r.status_code not in (200, 201):
                    print(f"[backend] HTTP {r.status_code}", flush=True)
            except Exception:
                self.available = False
                print("[backend] connection lost — metrics disabled", flush=True)

        threading.Thread(target=_post, daemon=True).start()

    def teardown(self):
        """Called ONCE at inference end. Ends the experiment."""
        if not self.available or self.experiment_id is None:
            return

        try:
            s = self._get_session()
            r = s.post(
                f"{self.base_url}/experiments/{self.experiment_id}/end",
                timeout=5.0
            )
            if r.status_code in (200, 201, 204):
                print(f"[backend] experiment {self.experiment_id} ended "
                      f"(COMPLETED)", flush=True)
            else:
                print(f"[backend] end experiment returned HTTP {r.status_code}",
                      flush=True)
        except Exception as e:
            print(f"[backend] teardown error: {e}", flush=True)


# ── Reward / Observation / Action helpers ────────────────────────────────────

def compute_reward(obs):
    rtt_us=obs['rtt_us']; throughput=obs['throughput']
    loss=obs['packetLoss']; cWnd=obs['cWnd']
    if throughput==0 and rtt_us==0: return 0.0
    tput_norm=min(throughput/TMAX,1.0); reward_tput=float(np.sqrt(tput_norm))
    rtt_safe=max(rtt_us,RTT_MIN_US); excess=max(rtt_safe-RTT_MIN_US,0.0)/400_000.0
    penalty_rtt=min(excess**2*12.0,1.0)
    penalty_loss=(0.3+min(loss*0.05,0.5)) if loss>0 else 0.0
    cwnd_ratio=cWnd/BDP
    gauss=float(np.exp(-((cwnd_ratio-1.0)**2)/(2*0.5**2)))
    stability=0.1*tput_norm*gauss
    return float(np.clip(reward_tput-penalty_rtt-penalty_loss+stability,-2.0,1.1))

def obs_dict_to_numpy(obs):
    raw=np.array([float(obs['cWnd']),float(obs['rtt_us']),float(obs['throughput']),
        float(obs['packetLoss']),float(obs['segmentSize']),float(obs['bytesInFlight'])],dtype=np.float32)
    return np.clip(raw/OBS_MAX,0.0,1.0)

def decode_action(action, obs):
    seg_size=max(int(obs['segmentSize']),SEG_SIZE); MAX_CWND=seg_size*1000
    factor=float(np.clip(action[0],0.8,1.2))
    new_cWnd=int(np.clip(obs['cWnd']*factor,seg_size,MAX_CWND))
    new_ssThresh=int(new_cWnd*0.75) if factor<1.0 else min(int(new_cWnd*2),MAX_CWND*2)
    return new_cWnd, new_ssThresh

def bar(val, maxval, width=20, fill='█', empty='░'):
    filled = int(round(width * min(val, maxval) / maxval)) if maxval > 0 else 0
    return fill * filled + empty * (width - filled)

def print_dashboard(step, env, action, reward, backend):
    rtt_ms    = env['rtt_us'] / 1000.0
    tput_mbps = env['throughput'] / 1e6
    cwnd      = env['cWnd']
    loss      = env['packetLoss']
    factor    = float(action[0])

    if rtt_ms > 0:    rtt_hist.append(rtt_ms)
    if tput_mbps > 0: tput_hist.append(tput_mbps)
    cwnd_hist.append(cwnd)
    reward_hist.append(reward)
    action_hist.append(factor)
    loss_hist.append(loss)

    avg_rtt    = np.mean(rtt_hist)    if rtt_hist    else 0.0
    avg_tput   = np.mean(tput_hist)   if tput_hist   else 0.0
    avg_reward = np.mean(reward_hist) if reward_hist else 0.0
    avg_loss   = np.mean(loss_hist)   if loss_hist   else 0.0

    if   factor >= 1.15: act_label = '▲▲ GROW FAST'
    elif factor >= 1.05: act_label = '▲  grow     '
    elif factor >= 0.95: act_label = '── hold     '
    elif factor >= 0.85: act_label = '▼  shrink   '
    else:                act_label = '▼▼ SHRINK   '

    if   reward >= 0.7:  rew_icon = '[GREAT]'
    elif reward >= 0.4:  rew_icon = '[GOOD] '
    elif reward >= 0.1:  rew_icon = '[OK]   '
    elif reward >= 0.0:  rew_icon = '[LOW]  '
    else:                rew_icon = '[BAD]  '

    os.system('clear')
    print('╔══════════════════════════════════════════════════════════════╗')
    print('║          SAC TCP Congestion Control — Live Inference         ║')
    print('╠══════════════════════════════════════════════════════════════╣')
    print(f'║  Step : {step:<8d}   SimTime: {env["simTime_us"]/1e6:7.2f}s                    ║')
    print('╠══════════════════════════════════════════════════════════════╣')
    print('║  CURRENT OBSERVATION                                         ║')
    print(f'║  RTT        : {rtt_ms:8.2f} ms   {bar(rtt_ms,200)}  ║')
    print(f'║  Throughput : {tput_mbps:8.4f} Mbps {bar(tput_mbps,2.0)}  ║')
    print(f'║  cWnd       : {cwnd:8.0f} B    {bar(cwnd,340000)}  ║')
    print(f'║  Pkt Loss   : {loss:8.0f}      {bar(loss,10)}  ║')
    print(f'║  BytesInFlt : {env["bytesInFlight"]:8.0f} B                              ║')
    print(f'║  SegSize    : {env["segmentSize"]:8.0f} B                              ║')
    print('╠══════════════════════════════════════════════════════════════╣')
    print('║  AGENT DECISION                                              ║')
    print(f'║  Action     : {factor:+.4f}   {act_label}                     ║')
    print(f'║  New cWnd   : {decode_action(action,env)[0]:8.0f} B                              ║')
    print(f'║  New ssThresh:{decode_action(action,env)[1]:7.0f} B                              ║')
    print(f'║  Reward     : {reward:+.4f}   {rew_icon}                        ║')
    print('╠══════════════════════════════════════════════════════════════╣')
    print(f'║  ROLLING AVG (last {HISTORY} steps)                              ║')
    print(f'║  Avg RTT    : {avg_rtt:8.2f} ms   {bar(avg_rtt,200)}  ║')
    print(f'║  Avg Tput   : {avg_tput:8.4f} Mbps {bar(avg_tput,2.0)}  ║')
    print(f'║  Avg Reward : {avg_reward:+8.4f}                                    ║')
    print(f'║  Avg Loss   : {avg_loss:8.2f}                                    ║')
    print('╠══════════════════════════════════════════════════════════════╣')
    if len(cwnd_hist) >= 2:
        mini = list(cwnd_hist)[-20:]
        mn, mx = min(mini), max(mini)
        spark_chars = ' ▁▂▃▄▅▆▇█'
        if mx > mn:
            spark = ''.join(spark_chars[int((v-mn)/(mx-mn)*8)] for v in mini)
        else:
            spark = '▄' * len(mini)
        print(f'║  cWnd trend : {spark:<20s}  min={mn:.0f} max={mx:.0f}  ║')
    if backend.available:
        tag = f'● backend exp={backend.experiment_id} flow={backend.flow_id}'
    else:
        tag = '○ backend offline'
    print(f'║  {tag:<56s}  ║')
    print('╚══════════════════════════════════════════════════════════════╝')


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--model',required=True)
    parser.add_argument('--duration',type=int,default=60)
    parser.add_argument('--log_every',type=int,default=10,
                        help='Print dashboard every N steps (default 10)')
    parser.add_argument('--post_every',type=int,default=5,
                        help='Post metrics to backend every N steps (default 5)')
    parser.add_argument('--backend_url',type=str,
                        default='http://localhost:8080/api',
                        help='Backend API base URL')
    args=parser.parse_args()

    from stable_baselines3 import SAC
    print(f'[info] loading model: {args.model}',flush=True)
    model=SAC.load(args.model)
    print('[info] model loaded OK',flush=True)

    # 1. Clear stale shm, then Init pool BEFORE launching ns-3.
    os.system(f'ipcrm -M {SHM_ID} 2>/dev/null; true')
    print(f'[info] cleared stale shm',flush=True)

    from shm_pool import Init
    Init(SHM_ID, SHM_SIZE)
    print('[info] shm pool initialized',flush=True)

    # 2. Create wrapper
    from inference_wrapper import InferenceWrapper
    wrapper = InferenceWrapper(shm_id=SHM_ID, shm_size=SHM_SIZE)
    print('[info] wrapper created',flush=True)

    # 3. Launch ns-3
    ns3_env = os.environ.copy()
    ns3_env['NS_AI_KEY']  = str(SHM_ID)
    ns3_env['NS_AI_SIZE'] = str(SHM_SIZE)
    ns3_cmd = [BINARY, f'--duration={args.duration}']
    print(f'[info] launching ns3...', flush=True)
    ns3_log = open('/tmp/ns3_inference.log', 'w')
    ns3_proc = subprocess.Popen(ns3_cmd, stdout=ns3_log,
                                stderr=subprocess.STDOUT, env=ns3_env)
    time.sleep(3.0)

    if ns3_proc.poll() is not None:
        ns3_log.close()
        with open('/tmp/ns3_inference.log') as f:
            print(f'[error] ns3 crashed:\n{f.read()}',flush=True)
        sys.exit(1)
    print(f'[info] ns3 running PID={ns3_proc.pid}  (log: /tmp/ns3_inference.log)',flush=True)

    # 4. Setup backend (after ns3 starts, before inference loop)
    backend = BackendManager(base_url=args.backend_url)
    backend.setup(model_path=args.model, duration=args.duration)

    print('[info] starting inference loop...',flush=True)

    step=0; last_new_cWnd=3400; last_new_ssThresh=65535

    def shutdown(sig=None, frame=None):
        print('\n[info] shutting down...',flush=True)
        # End experiment in backend
        backend.teardown()
        wrapper.close()
        ns3_proc.terminate()
        try: ns3_log.close()
        except: pass
        if reward_hist:
            print(f'\n{"="*50}')
            print(f'  FINAL SUMMARY  ({step} steps)')
            print(f'{"="*50}')
            print(f'  Avg RTT      : {np.mean(rtt_hist) if rtt_hist else 0:.2f} ms')
            print(f'  Avg Tput     : {np.mean(tput_hist) if tput_hist else 0:.4f} Mbps')
            print(f'  Avg Reward   : {np.mean(reward_hist):.4f}')
            print(f'  Avg PktLoss  : {np.mean(loss_hist):.2f}')
            print(f'  Total steps  : {step}')
            print(f'  Backend      : {"connected" if backend.available else "offline"}')
            if backend.experiment_id:
                print(f'  Experiment   : {backend.experiment_id}')
            print(f'{"="*50}')
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            if ns3_proc.poll() is not None:
                print('[info] ns3 exited', flush=True)
                break

            env = wrapper.step(new_ssThresh=last_new_ssThresh, new_cWnd=last_new_cWnd)
            if env is None:
                print('[info] sim finished', flush=True)
                break
            if env.get('envType', 1) == 0:
                last_new_ssThresh=65535; last_new_cWnd=3400
                continue

            obs_np = obs_dict_to_numpy(env)
            action, _ = model.predict(obs_np, deterministic=True)
            last_new_cWnd, last_new_ssThresh = decode_action(action, env)
            reward = compute_reward(env)
            step += 1

            # Post metrics to backend (fire-and-forget)
            if step % args.post_every == 0:
                backend.post_metric(env, reward, float(action[0]))

            if step % args.log_every == 0:
                print_dashboard(step, env, action, reward, backend)

    except Exception as e:
        print(f'[error] {e}', flush=True)
        import traceback; traceback.print_exc()
    finally:
        shutdown()

if __name__ == '__main__':
    main()
