from stable_baselines3 import SAC
import numpy as np

model_path = "sac_tcp_990000_steps.zip"
model = SAC.load(model_path, device="cpu")

print("Action space:", model.action_space)

obs = np.array([0.002, 0.1, 0.01, 0.0, 0.002, 0.002] * 10, dtype=np.float32)
action, _ = model.predict(obs, deterministic=True)
print("Action for small state:", action)

obs_good = np.array([0.5, 0.2, 0.8, 0.0, 0.002, 0.5] * 10, dtype=np.float32)
action_good, _ = model.predict(obs_good, deterministic=True)
print("Action for good state:", action_good)
