"""
train_sac.py — SAC Training Script for DRL TCP Congestion Control
"""
import argparse, os, time
import numpy as np
from stable_baselines3 import SAC
from stable_baselines3.common.callbacks import (
    BaseCallback, CheckpointCallback, CallbackList)
from env_wrapper import Ns3TcpEnv


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--timesteps",     type=int,   default=2_000_000)
    p.add_argument("--sim_duration",  type=int,   default=200)
    p.add_argument("--learning_rate", type=float, default=3e-4)
    p.add_argument("--shm_key",       type=int,   default=1234)
    p.add_argument("--save_path",     type=str,   default="./checkpoints/")
    p.add_argument("--log_interval",  type=int,   default=100)
    p.add_argument("--resume",        type=str,   default=None)
    p.add_argument("--bottleneck_bandwidth", type=str, default="2Mbps")
    p.add_argument("--bottleneck_delay", type=str, default="20ms")
    p.add_argument("--access_bandwidth", type=str, default="10Mbps")
    p.add_argument("--access_delay", type=str, default="20ms")
    p.add_argument("--queue_disc_type", type=str, default="ns3::PfifoFastQueueDisc")
    p.add_argument("--topology_file", type=str, default="")
    p.add_argument("--reward_profile", type=str, default="BALANCED")
    p.add_argument("--network_arch",  type=str, default="256,256")
    return p.parse_args()


class TcpLogCallback(BaseCallback):
    def __init__(self, steps_per_episode, log_interval):
        super().__init__(verbose=0)
        self.steps_per_episode = steps_per_episode
        self.log_interval      = log_interval
        self._last_log      = 0
        self._episode       = 0
        self._ep_start_step = 0
        self._ep_rewards    = []
        self._t0            = None

    def _on_training_start(self):
        self._t0 = time.time()

    def _on_step(self):
        step = self.num_timesteps
        if (step - self._ep_start_step) >= self.steps_per_episode:
            avg = np.mean(self._ep_rewards) if self._ep_rewards else 0.0
            elapsed = time.time() - self._t0 if self._t0 else 0
            print(f"\n[Episode {self._episode} END] "
                  f"steps={step} avg_r={avg:.4f} elapsed={elapsed:.0f}s\n")
            self._episode += 1
            self._ep_start_step = step
            self._ep_rewards = []
        if self.locals.get("rewards") is not None:
            self._ep_rewards.extend(self.locals["rewards"].tolist())
        if step - self._last_log >= self.log_interval:
            self._last_log = step
            info   = (self.locals.get("infos") or [{}])[0]
            reward = (self.locals.get("rewards") or [0.0])[0]
            tput   = info.get("throughput", 0)
            tput_s = f"{tput/1e3:.1f}KB/s" if isinstance(tput,(int,float)) else str(tput)
            print(f"[Step {step:>7}] Ep:{self._episode} | "
                  f"cWnd:{info.get('cWnd','?')}->{info.get('new_cWnd','?')} | "
                  f"RTT:{info.get('rtt_us','?')}us | Tput:{tput_s} | "
                  f"Loss:{info.get('packetLoss','?')} | R:{reward:.4f}")
        if os.path.exists("/sim/sim_server/.stop_training"):
            print("\n[Training] .stop_training flag detected! Gracefully stopping...", flush=True)
            return False
        return True

    def _on_training_end(self):
        elapsed = time.time() - self._t0 if self._t0 else 0
        print(f"\n[Training Complete] episodes={self._episode} "
              f"elapsed={elapsed:.0f}s ({elapsed/3600:.1f}h)")


def main():
    args = parse_args()
    # FIX: Make sim_duration long enough that ALL timesteps fit in ONE episode.
    # This avoids inter-episode resets which deadlock on the SHM protocol.
    # Each 10ms sim step = 1 RL step → need sim_duration >= timesteps * 0.01 / 0.4
    # Using factor of 25: steps_per_episode = sim_duration * 25
    min_sim_duration = (args.timesteps // 25) + 100   # +100s buffer
    sim_duration = max(args.sim_duration, min_sim_duration)
    steps_per_episode = sim_duration * 25
    os.makedirs(args.save_path, exist_ok=True)

    print(f"[Config] sim_duration={sim_duration}s  steps_per_episode={steps_per_episode:,}  "
          f"total_timesteps={args.timesteps:,}")

    env = Ns3TcpEnv(
        shm_key=args.shm_key, shm_size=1_048_576,
        max_steps=steps_per_episode, sim_duration=sim_duration,
        bottleneck_bandwidth=args.bottleneck_bandwidth,
        bottleneck_delay=args.bottleneck_delay,
        access_bandwidth=args.access_bandwidth,
        access_delay=args.access_delay,
        queue_disc_type=args.queue_disc_type,
        topology_file=args.topology_file,
        reward_profile=args.reward_profile,
    )

    if args.resume and os.path.exists(args.resume):
        print(f"[Resume] Loading from {args.resume}")
        model = SAC.load(args.resume, env=env,
                         learning_rate=args.learning_rate, device="cpu")
    else:
        # Determine specific gamma based on reward profile
        profile_gamma = 0.97
        if args.reward_profile == "AGGRESSIVE":
            profile_gamma = 0.98
        elif args.reward_profile == "CALM":
            profile_gamma = 0.95

        # Parse network_arch string "256,256,128" -> [256, 256, 128]
        arch_list = [int(x.strip()) for x in args.network_arch.split(",") if x.strip()]

        model = SAC(
            "MlpPolicy", env,
            learning_rate=args.learning_rate,
            buffer_size=1_000_000, learning_starts=5_000,
            batch_size=256, train_freq=4, gradient_steps=4, # Restored 1:1 data-to-grad
            gamma=profile_gamma, # 33 steps tracking one RTT loop
            tau=0.01, # Faster soft-target updates
            ent_coef="auto", target_entropy=-0.5, # Exploit fast
            policy_kwargs=dict(net_arch=arch_list), 
            verbose=1, device="cpu",
        )

    print(f"\n[Training] timesteps={args.timesteps:,}  steps/ep={steps_per_episode:,}")
    
    # Catch SIGTERM (from backend cancellation) to gracefully save the model
    import signal
    def sigterm_handler(signum, frame):
        raise KeyboardInterrupt("SIGTERM received")
    signal.signal(signal.SIGTERM, sigterm_handler)

    try:
        model.learn(
            total_timesteps=args.timesteps,
            callback=CallbackList([
                TcpLogCallback(steps_per_episode, args.log_interval),
                CheckpointCallback(save_freq=10_000, save_path=args.save_path,
                                   name_prefix="sac_tcp", verbose=1),
            ]),
            reset_num_timesteps=(args.resume is None),
            log_interval=10,
        )
    except KeyboardInterrupt:
        print("\n[Training] Interrupted.")
    except Exception as e:
        import traceback; traceback.print_exc(); raise
    finally:
        # Save exact step model so it's not lost
        final_model_name = f"sac_tcp_model_final_step_{model.num_timesteps}"
        model.save(final_model_name)
        model.save("sac_tcp_model_final")
        print(f"[Training] Saved {final_model_name}.zip")
        print("[Training] Saved sac_tcp_model_final.zip")
        env.close()


if __name__ == "__main__":
    main()