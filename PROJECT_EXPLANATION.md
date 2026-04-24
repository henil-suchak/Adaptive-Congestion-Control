# Adaptive TCP Congestion Control using Deep Reinforcement Learning (SAC)

## Complete Project Explanation — Viva / Interview / Deep Understanding Guide

> This document explains the full-stack SAC congestion-control project in extreme detail,
> grounded in the actual source code of this repository:
> `sim_inference.cc`, `tcp-rl-env-inference.{h,cc}`, `tcp-rl-inference.cc`, `run_inference.py`,
> `FlowMetricController.java`, `FlowMetric.java`, `WebSocketConfig.java`,
> `useMetricsWebSocket.js`, `App.js`, and the component / entity / service layout.
>
> Read it once front-to-back for viva; later use any single section as a "cue card".

---

# PART 1 — PROBLEM STATEMENT (THE FOUNDATION)

## 1.1 What is computer networking?

A **computer network** is a set of machines that can exchange bits with each other over physical media (copper, fiber, wireless). Because those machines are not all connected to each other directly, messages are cut into **packets** and forwarded hop-by-hop through intermediate devices called **routers** and **switches**.

Real-world analogy: think of the network as a postal system.

- Your message = a large parcel
- Packet = one envelope (the parcel cut into small envelopes)
- Router = a sorting office that forwards envelopes toward the destination
- Link bandwidth = the width of the conveyor belt in that sorting office
- Queue = the pile of envelopes waiting at the sorting office when the belt is full

The key property: **links have finite capacity, and routers have finite queues.** This is where congestion comes from.

## 1.2 What is TCP?

TCP (**Transmission Control Protocol**) is the protocol running on top of IP that gives you:

1. **Reliability** — if a packet is lost, it is retransmitted.
2. **Ordering** — packets arrive in the order they were sent.
3. **Flow control** — sender doesn't overwhelm the receiver.
4. **Congestion control** — sender doesn't overwhelm the *network*.

TCP sits between your application (HTTP, video, SSH) and IP. Almost every "download", "page load", or "video chunk" you use is TCP (or QUIC, which internally uses the same ideas).

The core data structure we care about in this project is the **congestion window, `cwnd`** — the number of bytes TCP is allowed to have "in flight" (sent but not yet ACKed). Every ACK tells TCP "this much data got through," and TCP uses that feedback to grow or shrink `cwnd`.

`cwnd` is the **only** knob the sender really controls in the original TCP design. The entire game is: *how fast should I grow it, and how much should I cut it on loss?*

## 1.3 Why does congestion happen?

Congestion happens when **multiple senders collectively send faster than the slowest ("bottleneck") link can drain.** Packets start piling up in the router queue upstream of that link. When the queue fills, the router drops packets.

Symptoms a sender can observe:

- **RTT (Round-Trip Time) rises** — packets are waiting in queues.
- **Packet loss** — tail of the queue is dropped.
- **Throughput stops increasing** even though you're sending more — you're just filling queues, not getting more bytes through.

Real-world examples where this matters:

- **YouTube / Netflix**: if your TCP overshoots, you get re-buffering. If it undershoots, you get 360p instead of 1080p.
- **Large downloads / OS updates**: under-aggressive TCP leaves half the bandwidth on the floor.
- **Video calls / online games**: over-aggressive TCP fills queues → latency spikes → stuttering.
- **Data center storage**: "incast" collapse, where many workers finish at once and their ACKs collide.

## 1.4 What is congestion control?

Congestion control is the **algorithm the sender uses to decide how fast to send** so that:

- The bottleneck is kept *full but not overflowing*.
- Losses are minimized.
- Multiple flows share the link fairly.

Formally: the sender uses `cwnd` and `ssThresh` (slow-start threshold) to decide how many bytes can be outstanding. On every ACK, the congestion-control algorithm adjusts these.

In ns-3, this is implemented as the `TcpCongestionOps` interface — a class that receives callbacks from the TCP socket and mutates `tcb->m_cWnd` and `tcb->m_ssThresh`. **Your entire project is essentially a custom subclass of `TcpCongestionOps` called `TcpRlInference`** (you can see this in `tcp-rl-inference.cc` lines 43–50).

## 1.5 Traditional TCP: Reno and CUBIC

### TCP Reno (1990, the classical one)

Two phases:

1. **Slow Start**: `cwnd` *doubles* every RTT (exponential growth) until it hits `ssThresh` or a loss.
2. **Congestion Avoidance (AIMD)**: `cwnd += 1 MSS` every RTT (Additive Increase). On loss: `cwnd = cwnd / 2` (Multiplicative Decrease).

This is the famous "sawtooth" pattern. Problem: over high-bandwidth, high-delay links ("long fat networks"), `+1 per RTT` is painfully slow to recover after a loss.

### TCP CUBIC (Linux default since 2006, what you're comparing against in `sim_inference.cc` line 168)

Instead of a linear increase, CUBIC grows `cwnd` as a **cubic function of time since the last loss**:

```
W(t) = C · (t − K)^3 + W_max
```

where `W_max` is the `cwnd` at last loss and `K = ∛(W_max · β / C)`.

Intuition:

- **Concave part** (right after a loss): grow slowly, carefully approach the previous `W_max`.
- **Plateau** at `W_max`: look for the "sweet spot" where loss happened last time.
- **Convex part** (past `W_max`): grow aggressively to probe for new bandwidth.

CUBIC is RTT-independent (growth is based on wall-clock time, not RTTs), which makes it fair across flows with different delays and fast on high-BDP links.

## 1.6 Limitations of traditional TCP (the motivation of your project)

1. **Fixed, hand-tuned rules.** Constants like `β = 0.7`, `C = 0.4` were chosen by researchers in 2006. They are static.
2. **Loss-as-only-signal.** Both Reno and CUBIC only really react *after* loss. By then the queue is already full → high RTT → bad for latency-sensitive traffic.
3. **Not adaptive to environment.** A cubic curve tuned for a data center is not ideal for mobile 4G, and vice versa.
4. **Myopic.** The algorithm has no memory of "this network tends to be bursty" or "this link has a shallow buffer."
5. **Fairness is emergent, not learned.** Two CUBIC flows share the link OK, but mixing CUBIC with other algorithms breaks that.

The natural question: **what if the congestion-control algorithm could *learn* the right behavior from data?** That is the thesis of your project.

---

# PART 2 — WHY REINFORCEMENT LEARNING?

## 2.1 What is RL?

Reinforcement Learning is a paradigm of machine learning where an **agent** learns by **interacting** with an **environment**. It's different from supervised learning: nobody gives the agent the "correct label." Instead, the agent tries actions, sees consequences, and gets a **reward** — a scalar number — that measures how good the consequence was.

Core formalism: **Markov Decision Process (MDP)**.

| Concept             | Meaning                                  | In this project                                                      |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| State `s_t`         | What the agent observes at time t        | RTT, throughput, `cwnd`, loss, segment size, bytes-in-flight         |
| Action `a_t`        | What the agent does                      | A scale factor in [0.8, 1.2] applied to `cwnd`                       |
| Reward `r_t`        | Scalar feedback                          | Based on throughput vs RTT vs loss (see `compute_reward` in `run_inference.py`) |
| Policy `π(a∣s)`     | Agent's strategy                         | The neural network inside the SAC model                              |
| Return `G_t`        | Discounted sum of future rewards         | What SAC tries to maximize                                           |
| Transition `P(s'∣s,a)` | Dynamics of the world                 | The ns-3 simulator — unknown to the agent                            |

The agent does **not** know the physics of the network. It just observes states, picks actions, and gets rewards. Over time, the policy converges to one that picks good actions in each state.

## 2.2 Mapping to *your* project

Look at your code:

- **Agent** = SAC model loaded in `run_inference.py` with `model = SAC.load(args.model)` (line 364).
- **Environment** = the ns-3 dumbbell topology running inside the C++ binary `rl-tcp-inference`.
- **State** = the C struct `sTcpRlInferenceEnv` in `tcp-rl-env-inference.h` (cWnd, rtt_us, throughput, packetLoss, segmentSize, bytesInFlight) — written into shared memory by ns-3.
- **Action** = struct `TcpRlInferenceAct` with `new_ssThresh` and `new_cWnd` — written back into shared memory by Python.
- **Reward** = `compute_reward(obs)` in Python — mixes throughput reward, RTT penalty, loss penalty, and a Gaussian "stability bonus" around BDP.
- **Step interval** = 10 ms (see `m_timeStep {MilliSeconds (10)}` in `tcp-rl-env-inference.h`). Every 10 simulated milliseconds, the ns-3 environment writes a fresh observation and waits for Python's action.

## 2.3 Why RL is a natural fit

- Congestion control is a **sequential decision problem with delayed feedback** — exactly what RL is designed for. An action taken now (grow `cwnd`) changes RTT and loss several RTTs later.
- No single labeled "correct action" exists — what's correct depends on the network, the queue depth, competing flows, and recent history.
- The feedback signal (RTT, throughput, loss) is continuous and cheap to generate.
- RL policies can, in principle, adapt to network conditions a hand-written algorithm never foresaw.

## 2.4 Advantages over CUBIC / Reno

1. **Learned, not hand-tuned.** Coefficients emerge from optimization, not from a PhD student's intuition.
2. **Multi-signal.** CUBIC mostly uses loss + time. SAC can use RTT, throughput, segments acked, bytes-in-flight, etc. simultaneously.
3. **Latency-aware.** Your reward penalizes RTT *before* loss happens (`penalty_rtt = min(excess²·12, 1)`), so SAC can learn to *avoid* filling queues rather than just reacting to drops.
4. **Continuous action space.** SAC can output any factor in [0.8, 1.2] — CUBIC is constrained to its specific curve shape.

---

# PART 3 — SAC (SOFT ACTOR-CRITIC) IN DETAIL

## 3.1 What is SAC?

SAC is an **off-policy, actor-critic, maximum-entropy** RL algorithm for **continuous action spaces**, introduced by Haarnoja et al. (2018). It is the default go-to continuous-control algorithm in `stable_baselines3` — which is exactly what you use (`from stable_baselines3 import SAC`, `run_inference.py` line 362).

Let me break down each word:

### "Actor-Critic"

Two neural networks cooperate:

- **Actor** (policy network) `π_θ(a∣s)`: takes state, outputs a probability distribution over actions. In SAC it's a **Gaussian** over the continuous action space — outputs mean and log-std.
- **Critic** (Q-function) `Q_φ(s, a)`: takes state *and* action, outputs the expected return (how much total reward you'll get from doing `a` in `s`). SAC actually uses **two Q-networks** ("twin critics") to reduce overestimation bias — this is the "TD3 trick."

The actor is improved by **climbing the critic**: the actor changes its parameters so that the actions it outputs have higher Q-values.

### "Soft" / "Maximum Entropy"

Standard RL maximizes `E[Σ r_t]`. SAC maximizes:

```
J(π) = E[ Σ_t  r_t  +  α · H(π(·|s_t)) ]
```

The extra term `α · H(π)` is the **entropy bonus**. High entropy = the policy stays "spread out" and keeps exploring. `α` is the **temperature**, and SAC actually learns `α` automatically to hit a target entropy.

Why this matters for congestion control: a deterministic policy could collapse into "always grow a tiny bit," never discovering that occasionally shrinking more aggressively is useful. Entropy keeps the agent curious.

### "Off-policy"

SAC stores transitions `(s, a, r, s')` in a **replay buffer** and learns from *past* transitions, not just the latest episode. This is **much more sample-efficient** than on-policy methods like PPO — critical when every sample costs a simulator step.

## 3.2 The SAC update in one page

Per gradient step:

1. Sample a minibatch `(s, a, r, s')` from the replay buffer.
2. **Critic update** — make each Q-network predict the Bellman target:

   ```
   y = r + γ · ( min_{i=1,2} Q_{φ̄_i}(s', a')  −  α · log π_θ(a' | s') ),
       a' ~ π_θ(· | s')
   ```

   Minimize `(Q_φ(s,a) − y)²`.
3. **Actor update** — make the policy prefer high-Q, high-entropy actions:

   ```
   ∇_θ J_π = E[ ∇_θ α · log π_θ(a|s) − ∇_θ min_i Q_{φ_i}(s, a) ]
   ```
4. **Temperature update** — adjust `α` so entropy matches a target (usually `−dim(action)`).
5. **Target network update** — slowly move `φ̄_i ← τ φ_i + (1−τ) φ̄_i`.

You don't need to run this during inference — the model is pre-trained. At deploy time we only call `model.predict(obs, deterministic=True)` (exactly what you do in `run_inference.py` line 460).

## 3.3 Why SAC and not DQN / PPO?

|                      | DQN                  | PPO                | **SAC**                                            |
| -------------------- | -------------------- | ------------------ | -------------------------------------------------- |
| Action space         | Discrete only        | Both               | **Continuous** (what we need for a factor in [0.8, 1.2]) |
| Sample efficiency    | Medium               | Low (on-policy)    | **High** (off-policy + replay)                     |
| Stability            | Sensitive            | Stable             | **Very stable** thanks to entropy & twin critics   |
| Exploration          | ε-greedy (crude)     | Stochastic policy  | **Principled** via entropy bonus                   |

For congestion control:

- Discrete actions (DQN) would mean you'd have to pick, say, 5 fixed multipliers. You'd lose fine-grained control.
- PPO would throw away every sample after one use — wasteful when each sample is a real 10 ms of ns-3 simulation.
- SAC gives you smooth continuous action, stable training, and re-uses data efficiently.

## 3.4 What SAC looks like *in your code specifically*

Observation (6 floats, normalized by `OBS_MAX` — `run_inference.py` line 16):

```
[cWnd, rtt_us, throughput, packetLoss, segmentSize, bytesInFlight] / OBS_MAX
```

Each component is divided by its max and clipped to [0, 1] — a standard trick so that all inputs have similar scales and the neural network doesn't fixate on the largest-magnitude feature.

Action (1 float):

```
factor       = clip(action[0], 0.8, 1.2)
new_cWnd     = clip(cWnd * factor, seg_size, seg_size * 1000)
new_ssThresh = new_cWnd * 0.75  if factor < 1
               else  min(new_cWnd*2, MAX*2)
```

So the agent's output is a **multiplicative scale** on the current `cwnd` — it can shrink by up to 20% or grow by up to 20% per step. This is nicer than outputting an absolute `cwnd`, because it works across orders of magnitude of link bandwidth.

Reward (`compute_reward` in `run_inference.py`):

```
reward = √(throughput / TMAX)                              # grow throughput (concave = diminishing returns)
       − penalty_rtt                                        # quadratic penalty if RTT > RTT_min
       − penalty_loss                                       # cliff penalty on any loss
       + 0.1 · tput_norm · Gaussian(cwnd/BDP around 1)      # stability bonus near BDP
```

This is actually a quite sophisticated reward — note the **Gaussian stability term around BDP** (bandwidth-delay product = 10 000 bytes for your link). It nudges SAC toward sitting at BDP, which is the textbook-optimal operating point.

---

# PART 4 — SYSTEM ARCHITECTURE (THE BIG PICTURE)

## 4.1 The five-layer stack

```
 ┌─────────────────────────────────────────────────────────┐
 │  React dashboard   (port 3000)                          │
 │     – 3 tabs: SAC / CUBIC / Compare                     │
 │     – Recharts graphs, WebSocket client                 │
 └──────────────▲──────────────────────────────────────────┘
                │ STOMP over SockJS (/topic/metrics)
                │ WebSocket
 ┌──────────────┴──────────────────────────────────────────┐
 │  Spring Boot backend   (port 8080)                      │
 │     – REST: /api/experiments, /api/flows, /api/metrics  │
 │     – Broadcasts to /topic/metrics                      │
 │     – H2 database (congestion-db.mv.db)                 │
 └──────────────▲──────────────────────────────────────────┘
                │ HTTP POST /api/metrics (JSON)
 ┌──────────────┴──────────────────────────────────────────┐
 │  Python controller (run_inference.py)                   │
 │     – Loads SAC model, reads obs, posts metrics         │
 │     – CubicMetricsReader thread tailing CSV             │
 └──────────────▲──────────────────────────────────────────┘
                │ Shared memory (SysV SHM id=2333, ns3-ai)
 ┌──────────────┴──────────────────────────────────────────┐
 │  ns-3 simulator binary (rl-tcp-inference)               │
 │     – Dumbbell topology, 2 flows: SAC + CUBIC           │
 │     – Bottleneck 2 Mbps / 20 ms / FqCoDel 100p          │
 │     – TcpRlInference CongestionOps + CUBIC trace CSV    │
 └─────────────────────────────────────────────────────────┘
```

## 4.2 What each layer does and *why it exists*

### ns-3 (C++)

**Does:** Simulates packets, routers, queues, two TCP senders (SAC-controlled and CUBIC), measures RTT / throughput / loss with microsecond precision.

**Why needed:** RL requires millions of "steps" — you cannot get that cheaply, safely, or reproducibly from a real network.

### Python controller

**Does:** Loads the pre-trained SAC model, reads observations over shared memory, runs `model.predict`, writes back actions, posts metrics to the backend, and in parallel tails the CUBIC CSV trace and posts those too.

**Why needed:** `stable_baselines3` is Python, and PyTorch is Python. C++ can't natively call a Python RL model with <10 ms latency unless you bridge it. The bridge is ns3-ai (shared memory).

### Spring Boot backend (Java)

**Does:**

- Persists experiments, flows, and per-step metrics to H2.
- Provides REST APIs the Python process calls (`POST /api/experiments`, `POST /api/metrics`, etc.).
- Pushes every incoming metric to all connected dashboard clients via **STOMP-over-WebSocket** (`messagingTemplate.convertAndSend("/topic/metrics", dto)` — `FlowMetricController.java` line 55).

**Why needed:** Single point of truth for multiple consumers (live dashboard, later analysis, comparison tab). Also, it's a nice separation-of-concerns: the RL pipeline doesn't know anything about JSON, WebSockets, or the frontend.

### React dashboard

**Does:** Subscribes to `/topic/metrics`, splits incoming messages by `algorithmType` into SAC vs CUBIC arrays, and renders them with Recharts in three tabs.

**Why needed:** Human-visible story of what the agent is doing. Also the comparison tab that is your main demo.

## 4.3 Why *not* direct connections?

> "Why doesn't Python just send metrics directly to React?"

Three reasons:

1. **Persistence.** If the frontend is closed, metrics disappear. With Spring Boot + H2 you can reload past experiments.
2. **Multiple clients.** Any number of browser tabs can subscribe to `/topic/metrics` and they'll all see the same stream.
3. **Fan-in.** The backend merges metrics from the Python process *and* the CUBIC CSV reader, and will cleanly accept more producers later (e.g., a second SAC variant).

> "Why doesn't Python just invoke ns-3 via stdin/stdout?"

Because you need **sub-millisecond round-trip** between ns-3 and Python, hundreds of times per simulated second. Stdio has unbounded latency due to OS pipe buffers and Python's GIL. Shared memory is ~100× faster and that's exactly why ns3-ai uses it.

## 4.4 The three communication protocols

| Boundary            | Protocol                                                                                         | Why this and not X                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| ns-3 ↔ Python       | **SysV shared memory + condition variables** (ns3-ai), `SHM_ID=2333`, 4096 bytes                 | Must be fast (10 ms steps) and handle lock-step producer/consumer semantics with `SetCond/GetCompleted`.               |
| Python → Backend    | **HTTP POST JSON** (`requests.Session`, fire-and-forget background threads)                      | Simple, firewall-friendly, decoupled — the backend can be restarted without breaking the RL loop (the code literally sets `self.available=False` on any exception). |
| Backend → Frontend  | **WebSocket with STOMP over SockJS**                                                             | Real-time push (no polling), text-based frames (debuggable in Chrome DevTools), auto-reconnect (`reconnectDelay: 2000` in your hook). |

---

# PART 5 — NS-3 (THE CORE SIMULATOR) — DEEP

## 5.1 What is ns-3?

ns-3 is a **discrete-event network simulator** written in C++. "Discrete event" means time advances by jumping from one scheduled event to the next, not in fixed ticks. Each packet emission, ACK reception, router forward, and timer fire is an event.

It comes with faithful models of:

- TCP (multiple variants: Reno, CUBIC, BBR, Vegas, …)
- IP routing, ARP, ICMP
- Link-layer queues (DropTail, RED, FqCoDel, CoDel, …)
- Physical layer models (Wi-Fi, LTE, point-to-point)

## 5.2 Why a simulator, not a real network?

1. **Reproducibility.** Same seed → same packet traces. You cannot do that on the internet.
2. **Speed.** ns-3 simulates 200 seconds of traffic in ≲30 seconds of wall time — and you can actually run it *slower* than real time by design here because Python has to respond every 10 ms.
3. **Safety.** You can't deploy a half-trained SAC model to real infrastructure; it might DDoS itself.
4. **Observability.** You can read microsecond-accurate `cwnd`, RTT, bytes-in-flight directly from TCP internals. No tcpdump magic needed.
5. **Controlled comparison.** You can run SAC and CUBIC in the *same* simulation sharing the *same* bottleneck (exactly what `sim_inference.cc` does — nodes 2 and 3 share routers 0 and 1).

## 5.3 Your topology — line by line

From `sim_inference.cc` (lines 126–158):

```
 leftNode[0] (SAC)   ──┐                                    ┌── rightNode[0] (SAC sink, port 9)
                        ├── R0 ══[2 Mbps / 20 ms, FqCoDel 100p]══ R1 ──┤
 leftNode[1] (CUBIC) ──┘                                    └── rightNode[1] (CUBIC sink, port 10)

 All access links: 10 Mbps / 20 ms point-to-point
```

Six nodes, IDs 0–5:

- Node 0, 1: routers
- Node 2: SAC sender
- Node 3: CUBIC sender
- Node 4: SAC sink
- Node 5: CUBIC sink

**This is called a "dumbbell" topology** — two clusters joined by a single shared link. It is the canonical experimental setup for studying congestion because **all bottleneck-competition behavior happens on that middle link.**

### Why the bottleneck is important

- Access links: 10 Mbps, but the middle is 2 Mbps. So senders at 10 Mbps cannot all be satisfied — someone's packets must queue.
- Delay: 20 ms per link, one-way = 4 × 20 = 80 ms round trip at minimum → **RTT_min ≈ 40 020 µs** (matches your `RTT_MIN_US` constant).
- **BDP = 2 Mbps × 80 ms ≈ 20 000 bits ≈ 2500 bytes**. (Your code uses `BDP = 10_000` bytes as a normalizer, which is conservative.)

### Why FqCoDel on the bottleneck

`tch.SetRootQueueDisc ("ns3::FqCoDelQueueDisc", "MaxSize", "100p")` — Fair Queuing + CoDel AQM.

- **Fair queuing**: each flow gets its own virtual queue; one greedy flow can't starve another.
- **CoDel (Controlled Delay)**: an AQM that drops packets based on how long they've sat in the queue (target 5 ms). Keeps RTTs low even under full load.

Without FqCoDel, a greedy CUBIC flow would fill the router buffer and the SAC flow would see 500 ms RTTs — your comparison would be invalid. FqCoDel makes the comparison fair.

### The CUBIC sink has `DropTailQueue 1p`

Line 145: `bottleneckLink.SetQueue ("ns3::DropTailQueue", "MaxSize", "1p")`. This is the *device*-level queue. The real queue that matters is the *traffic-control* (qdisc) queue installed on line 183, which is FqCoDel 100p. The device queue is just the tiny NIC ring buffer.

## 5.4 Packet flow, step by step

1. Application (`BulkSendHelper` on node 2) tells TCP "send as much as you can."
2. TCP on node 2 forms a segment of size `mtu_bytes - 60 = 340` bytes, pushes it down through IP → point-to-point NetDevice.
3. Segment travels 20 ms to router 0.
4. Router 0 dequeues from FqCoDel (on the side feeding the 2 Mbps link) and forwards.
5. Segment travels 20 ms to router 1.
6. Router 1 forwards it 20 ms onward to node 4.
7. Node 4's TCP ACKs the segment back the same way (~40 ms return).
8. When the ACK arrives at node 2, **`TcpSocketBase` calls the `TcpCongestionOps::PktsAcked`** callback — which is *your* `TcpRlInferenceEnv::PktsAcked` — with the RTT of that segment.

## 5.5 How RTT, throughput, `cwnd`, and loss are measured

**RTT (per-segment):**
TCP times each segment: `t_ACK_received − t_segment_sent`. ns-3 passes this directly to `PktsAcked(tcb, segmentsAcked, const Time& rtt)`. In your env you accumulate a sum and count (`m_rttSum`, `m_rttSampleNum`) and at the end of each 10 ms step compute the mean, then apply an **EMA smoother** (`α = 0.3`):

```
m_smoothedRtt = 0.3 · mean_rtt + 0.7 · m_smoothedRtt
```

EMA removes the single-ACK jitter that would otherwise confuse the RL agent.

**Throughput:**
`TxPktTrace` is fired for every transmitted segment and accumulates `m_txBytes`. At step boundary:

```
rawTput_bps     = m_txBytes / stepSec        // stepSec = 0.01
m_smoothedTput  = 0.3 · rawTput + 0.7 · m_smoothedTput
```

Note: you measure **transmitted** bytes (throughput *from the sender's POV*). Goodput (received) is measured separately on the sink via the `Rx` trace of `PacketSink`.

**`cwnd` and bytes in flight:**
These are read straight from the TCP control block: `m_tcb->m_cWnd.Get()`, `m_tcb->m_bytesInFlight.Get()`. They are *exact*, not measured — that's the superpower of a simulator.

**Loss count:**
ns-3's TCP state machine transitions to `CA_LOSS` when the retransmission timer fires or three duplicate ACKs are seen. Your `CongestionStateSet` hook observes this and increments `m_packetLossCount`.

## 5.6 How CUBIC (the baseline) runs alongside

`sim_inference.cc` lines 164–168:

```cpp
leftNodes.Get (0)->GetObject<TcpL4Protocol>()->SetAttribute (
    "SocketType", TypeIdValue (TcpRlInference::GetTypeId ()));
leftNodes.Get (1)->GetObject<TcpL4Protocol>()->SetAttribute (
    "SocketType", TypeIdValue (TypeId::LookupByName ("ns3::TcpCubic")));
```

The genius of ns-3's TCP architecture: the choice of algorithm is **per-node**, just by swapping the `SocketType`. Node 2 uses your custom `TcpRlInference` congestion ops; node 3 uses the stock ns-3 CUBIC implementation. They share everything else (application, IP stack, bottleneck).

CUBIC metrics are traced by wiring callbacks (lines 83–94) to built-in TCP attributes:

- `/NodeList/3/.../CongestionWindow` → `CubicCwndChanged`
- `/NodeList/3/.../RTT` → `CubicRttChanged`
- `/NodeList/3/.../CongState` → detects `CA_LOSS`
- `/NodeList/3/.../BytesInFlight`

Then every 100 ms (line 74) `WriteCubicMetrics` writes a CSV row to `/tmp/cubic_metrics.csv`. The Python process later tails that file.

## 5.7 How ns-3 talks to Python — shared memory in detail

ns-3 alone cannot call Python. You use the **ns3-ai** module (`contrib/ns3-ai/`) which provides the `Ns3AIRL` base class.

Look at `tcp-rl-env-inference.h` line 36: `class TcpRlInferenceEnv : public Ns3AIRL<sTcpRlInferenceEnv, TcpRlInferenceAct>`.

`Ns3AIRL` is a templated wrapper around a **SysV shared-memory segment** keyed on an integer id (`2333` in your code). The two template parameters are:

- `sTcpRlInferenceEnv` — the struct sent from C++ to Python (observation).
- `TcpRlInferenceAct` — the struct sent from Python to C++ (action).

The struct `sTcpRlInferenceEnv` is marked `Packed` (h:26) — **byte-level packing**, no compiler padding. This is critical because on the Python side you reconstruct the same struct with `ctypes`; if either side adds padding, field offsets diverge and you read garbage.

### The lock-step dance

Each step:

**C++** (`SendObsGetAction` in `tcp-rl-env-inference.cc`):

```cpp
auto env = EnvSetterCond();      // acquire write-side, Python is blocked
env->cWnd = ...;                 // fill observation
...
SetCompleted();                  // release — Python unblocked

auto act = ActionGetterCond();   // block until Python writes
m_new_cWnd = act->new_cWnd;
GetCompleted();                  // release Python
```

**Python** (via `wrapper.step(...)`):

```python
# (inside InferenceWrapper)
obs    = read_env_from_shm()     # blocks until C++ SetCompleted
action = model.predict(obs)
write_action_to_shm(action)      # unblocks C++
```

It's a classic **producer-consumer rendezvous** using a POSIX-style condition variable hidden inside ns3-ai. Neither side races; both are guaranteed a consistent view every step.

### Why shared memory, not a socket?

- A TCP socket to localhost can do ~10 µs per round trip on a good day. Fine for 10 ms steps but *all* CPU goes to syscalls.
- Shared memory is ~100 ns — negligible overhead.
- Also, ns-3 runs in simulated time but Python runs in wall time. Shared memory + a condvar keeps them lock-stepped without either one racing ahead.

---

# PART 6 — PYTHON (INFERENCE LAYER)

## 6.1 `run_inference.py` top-level flow

Open the file at the bottom and follow `main()`:

1. **Parse args** (`--model`, `--duration`, `--log_every`, `--post_every`, `--backend_url`, `--cubic_trace`).
2. **Load SAC** from disk: `model = SAC.load(args.model)` — this is a `stable_baselines3.SAC` object containing the policy network and critics. Only the policy is used at inference.
3. **Reset shared memory** (`ipcrm -M 2333`) and delete stale CUBIC trace. Otherwise you'll attach to a zombie segment from a prior crashed run.
4. **Initialize the shm pool** (`Init(SHM_ID, SHM_SIZE)`), then build the `InferenceWrapper`.
5. **Spawn ns-3 as a subprocess** with env vars `NS_AI_KEY=2333`, `NS_AI_SIZE=4096`. Redirect its stdout/stderr to `/tmp/ns3_inference.log` so they don't interleave with the Python dashboard.
6. Wait 3 s for ns-3 to come up, then check `ns3_proc.poll()` to detect early crashes.
7. **Set up backend** (`BackendManager.setup`): create experiment, start it, create SAC flow, create CUBIC flow — four REST calls.
8. **Start CubicMetricsReader** — a daemon thread that tails `/tmp/cubic_metrics.csv` and posts to the backend.
9. **Enter the inference loop** (the `while True:` starting at line 446). This is the heart of the project.
10. On exit (Ctrl-C, ns-3 exited, or exception) → `shutdown()` tears everything down cleanly.

## 6.2 One step of the inference loop (lines 446–473)

```python
env = wrapper.step(new_ssThresh=last_new_ssThresh, new_cWnd=last_new_cWnd)
```

Under the hood this does: write the *previous* action into shm → wait for ns-3 to post its new observation → return the obs as a dict.

```python
if env.get('envType', 1) == 0:        # init packet, not a real step
    ...; continue
obs_np = obs_dict_to_numpy(env)       # normalize the 6 features
action, _ = model.predict(obs_np, deterministic=True)
last_new_cWnd, last_new_ssThresh = decode_action(action, env)
reward = compute_reward(env)
step += 1
```

Then every `post_every` steps:

```python
backend.post_metric(backend.sac_flow_id, "SAC", env, reward, float(action[0]))
```

— fire-and-forget HTTP POST to `http://localhost:8080/api/metrics`, spawned in a **background thread** so it never blocks the 10 ms control loop.

Every `log_every` steps, `print_dashboard` clears the terminal and prints the beautiful Unicode-bar dashboard you see at runtime.

## 6.3 The observation pipeline (`obs_dict_to_numpy`)

```python
raw    = np.array([cWnd, rtt_us, throughput, packetLoss, segmentSize, bytesInFlight])
obs_np = np.clip(raw / OBS_MAX, 0.0, 1.0)
```

`OBS_MAX = [1_400_000, 200_000, 250_000, 100, 1_500, 1_400_000]` (line 16). Each column corresponds to one feature, and each max is the largest value expected during training. Clipping into [0,1] guarantees that no feature ever dominates the network inputs — a crucial stability trick for all RL with continuous states.

Note: `deterministic=True` in `model.predict`. At inference time we *don't* want entropy-driven exploration — we want the mean of the learned policy.

## 6.4 How action modifies `cwnd` (`decode_action`)

```python
factor       = np.clip(action[0], 0.8, 1.2)
new_cWnd     = clip(obs['cWnd'] * factor, seg_size, seg_size * 1000)
new_ssThresh = new_cWnd * 0.75 if factor < 1 else min(new_cWnd * 2, MAX*2)
```

Three properties:

- **Multiplicative:** scale-free. Works whether `cwnd` is 1 KB or 1 MB.
- **Bounded:** never shrink below 1 MSS, never grow beyond 1000 MSS (≈340 KB). Hard floor and ceiling.
- **`ssThresh` policy:** if we're shrinking, set `ssThresh` just below new `cWnd` so we don't re-enter slow start. If we're growing, set it high so slow start can keep going.

These three numbers are then written back into shm and picked up by `TcpRlInferenceEnv::SendObsGetAction`'s read-side (`tcp-rl-env-inference.cc` lines 160–163). The env stores them in `m_new_cWnd` and `m_new_ssThresh` and applies them next time the TCP socket calls any congestion-ops hook **only if the socket is in a safe state** (`CA_OPEN` or `CA_DISORDER` — see `ApplyCwndIfSafe`, lines 42–53). This guard is critical: during `CA_LOSS` / `CA_RECOVERY`, ns-3 asserts `BytesInFlight ≤ 1 MSS`. Blindly writing a large `cwnd` there would crash the simulator. Hard-won experience is in that comment block.

---

# PART 7 — BACKEND (SPRING BOOT)

## 7.1 Why a backend exists

Without the backend:

- Python would need to serve WebSocket itself (and Python isn't as good at it as Spring).
- No persistence → every experiment lost on Python exit.
- Can't replay / compare historical runs.
- Can't serve multiple dashboard tabs.

With the backend:

- **Single source of truth.** Every metric is stored in H2 (`congestion-db.mv.db`) via JPA.
- **Clean API surface.** Python only speaks JSON over HTTP.
- **Independent lifecycle.** The dashboard can be refreshed without restarting ns-3.

## 7.2 Domain model

Three entities:

- **`Experiment`** — one whole run: name, topology, bottleneck bandwidth, base delay, queue type, status, timestamps.
- **`Flow`** — one sender→receiver pair within an experiment, e.g. SAC sender on 10.1.1.1, CUBIC on 10.1.4.1. Fields: sender, receiver, protocol (`TCP-SAC-RL`), algorithmType (`SAC` / `CUBIC`).
- **`FlowMetric`** — one per-step measurement with `rttMs, throughputMbps, packetLossRate, cwndBytes, sendingRateMbps, reward, action, algorithmType` linked to a `Flow` via `@ManyToOne`.

See `FlowMetric.java`. Relationships:

```
Experiment 1 ──< Flow 1 ──< FlowMetric
```

## 7.3 REST endpoints (from `FlowMetricController.java` and friends)

- `POST /api/experiments` — create experiment
- `POST /api/experiments/{id}/start` — transition to RUNNING
- `POST /api/experiments/{id}/end` — transition to COMPLETED
- `POST /api/experiments/{id}/flows` — create flow
- **`POST /api/metrics`** — the high-frequency ingestion endpoint Python hits on every SAC step.
- `GET /api/flows/{flowId}/metrics`, `GET /api/experiments/{experimentId}/metrics`, `GET /api/metrics/latest` — read paths used by the frontend (and manual debugging).

## 7.4 The critical path: one metric in 3 ms

Look at `FlowMetricController.ingestFromAgent` (lines 34–58):

```java
@PostMapping("/metrics")
public FlowMetric ingestFromAgent(@RequestBody FlowMetricRequest request) {
    Long flowId = (request.getFlowId() != null) ? request.getFlowId() : 1L;

    FlowMetric flowMetric = flowMetricService.recordFlowMetric(
        flowId, request.getTimestamp(), request.getRttMs(),
        request.getThroughputMbps(), request.getPacketLossRate(),
        request.getCwnd(), request.getSendingRateMbps(),
        request.getReward(), request.getAction());

    predictionService.generateAndSavePrediction(flowMetric);

    FlowMetricDTO dto = new FlowMetricDTO(flowMetric);
    messagingTemplate.convertAndSend("/topic/metrics", dto);   // ← WebSocket broadcast

    return flowMetric;
}
```

One call: *persist → predict → broadcast*. That last line is the magic — `SimpMessagingTemplate.convertAndSend("/topic/metrics", dto)` pushes to **every subscribed browser tab instantly** via the embedded STOMP broker.

## 7.5 WebSocket configuration

`WebSocketConfig.java`:

```java
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
```

Translation:

- **Endpoint:** `ws://localhost:8080/ws` (with SockJS fallback for browsers that block raw WS).
- **Broker:** an in-memory STOMP broker with topic `/topic/metrics`.
- **Message flow:** server → `convertAndSend("/topic/metrics", dto)` → broker → every subscriber.

STOMP (Simple Text-Oriented Messaging Protocol) is just a tiny text framing over WebSocket. Think "pub/sub for WebSocket."

## 7.6 Real-time streaming path end-to-end

```
ns-3 writes obs to shm
 → Python reads obs, runs SAC, writes action to shm
 → Python background thread: requests.post("http://localhost:8080/api/metrics", json=payload)
 → FlowMetricController.ingestFromAgent
       ├── flowMetricService.recordFlowMetric (H2 insert)
       ├── predictionService.generateAndSavePrediction
       └── messagingTemplate.convertAndSend("/topic/metrics", dto)
 → STOMP broker pushes to every subscriber
 → useMetricsWebSocket.js handleMessage() fires
 → setSacMetrics / setCubicMetrics / setMergedMetrics
 → React re-renders the charts
```

End-to-end latency: ~tens of ms, dominated by HTTP and JSON parsing — invisible to the human eye.

---

# PART 8 — FRONTEND (REACT DASHBOARD)

## 8.1 Why React

- **Declarative UI.** The charts automatically re-render when state arrays update — no manual DOM work.
- **Component reuse.** Three tabs (`SACPage`, `CubicPage`, `ComparisonPage`) all consume the same `useMetricsWebSocket` hook.
- **Huge ecosystem.** Recharts (for graphs), stomp-js (for WebSocket), sockjs-client (for fallback), tailwindcss (styling) — all play nicely together.
- **Fast feedback loop.** Hot reload means you can tweak a chart and see it live without rebuilding the whole app.

## 8.2 Why WebSocket, not polling

With polling at, say, 500 ms:

- Browser fires a full HTTP request every 500 ms (regardless of whether new data exists).
- Latency floor is half your polling interval.
- Wastes CPU and network on both sides.
- Misses fast transients — if SAC takes a 3-step corrective action in 30 ms, you only see the end state.

With WebSocket:

- Connection is opened **once**.
- Each new metric arrives as a push frame within a few ms of being posted to the backend.
- Zero wasted traffic in idle periods.
- Natural fit for "stream of events" semantics.

## 8.3 The `useMetricsWebSocket` hook

```js
const client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    onConnect: () => { client.subscribe('/topic/metrics', handleMessage); },
    reconnectDelay: 2000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
});
```

On every message:

```js
const metric = JSON.parse(message.body);
const algo   = (metric.algorithmType || 'SAC').toUpperCase();
if (algo === 'CUBIC')  { setCubicCurrent(metric); setCubicMetrics(prev => [...prev, point].slice(-100)); }
else                   { setSacCurrent(metric);   setSacMetrics(prev => [...prev, point].slice(-100)); }
```

Three exported arrays — `sacMetrics`, `cubicMetrics`, `mergedMetrics` — each capped at 100 points so memory never blows up. `mergedMetrics` is the union-keyed-by-time array used by the Comparison tab's dual-line charts.

## 8.4 The three tabs

From `App.js`:

- **SAC tab** (`SACPage.jsx`): the star of the show. Shows, for the SAC flow:
  - the last **action** (scale factor) and **reward**,
  - the live **RTT** line,
  - live **throughput** line,
  - live **cWnd** line (the agent's knob — its shape reveals learned policy),
  - the **reward signal** over time.
- **CUBIC tab** (`CubicPage.jsx`): shows the baseline CUBIC flow. The graphs are annotated with three phases — slow start, congestion avoidance, loss recovery — and a phase-colored `CwndPhaseChart` so the viewer can literally *see* the cubic-curve sawtooth. Also includes a `NetworkTopology` diagram.
- **Compare tab** (`ComparisonPage.jsx`): dual-axis charts with SAC and CUBIC overlaid (`PersonalityCards` showing "rule-based aggressive" vs "learning-based stable", `KeyTakeaways` computing running averages and calling out trade-offs).

Plus auxiliary UI you've built: `GuidedTour` (tooltips anchored to DOM ids like `tour-sac-cwnd`), `ExplainModal`, `InfoTooltip`, `EventOverlay` + `EventTooltip` — these make the dashboard self-explanatory, not just pretty.

## 8.5 How to read each graph

- **RTT (ms).** Baseline ~80 ms (your 4×20 ms links). Spikes above that = queuing at the bottleneck. Persistent high RTT = bufferbloat.
- **Throughput (Mbps).** Upper bound 2 Mbps (your bottleneck). A good algorithm sits near 2 Mbps; a cautious one sits lower; one that thrashes dips periodically.
- **cWnd (bytes / KB).** The agent's control signal. Smooth growth = learning to probe gently. Sawtooth = Reno-like behavior. Erratic steps = SAC is exploring.
- **Reward.** Only defined for SAC. Should average > 0 for a working policy. Negative reward = the policy is losing on RTT or loss.
- **Action (SAC only).** The factor the agent chose. 1.0 = "hold." >1 = "grow." <1 = "shrink." Clustering near 1.0 with small excursions = a converged, stable policy.

---

# PART 9 — COMPLETE DATA FLOW (AS A STORY)

**T = 0 s.** You run `./mvnw spring-boot:run` in `backend/`. Spring Boot starts on port 8080. H2 initializes. WebSocket endpoint opens at `/ws`.

**T = 5 s.** You run `npm start` in `frontend/`. React dev server starts on port 3000. A browser window opens. The `useMetricsWebSocket` hook fires, opens a SockJS connection to `ws://localhost:8080/ws`, subscribes to `/topic/metrics`. The `connected` state becomes true; the connection dot in the nav turns green. All three tabs render empty charts.

**T = 10 s.** You run `python run_inference.py --model /path/to/sac_model.zip --duration 200` on the Linux/macOS machine where ns-3 is built.

- Python loads the SAC model (~1 s for a typical ~90 MB SB3 zip).
- Wipes stale shm id 2333 (`ipcrm -M`).
- Initializes the ns3-ai shm pool of 4 KB at key 2333.
- Spawns the ns-3 binary `rl-tcp-inference --duration=200 --cubicTrace=/tmp/cubic_metrics.csv` as a subprocess.
- Creates an `Experiment` via `POST /api/experiments` → backend returns `experimentId=42`.
- `POST /api/experiments/42/start` → RUNNING.
- Creates two flows → `sac_flow_id=101`, `cubic_flow_id=102`.
- Starts the `CubicMetricsReader` daemon thread: waits for `/tmp/cubic_metrics.csv` to appear.

**T = 13 s.** ns-3 is running.

- `TcpL4Protocol` on node 2 has been configured with `TcpRlInference`. As soon as the first ACK arrives for the SAC flow, `TcpRlInference::IncreaseWindow` triggers `CreateEnv()`, which constructs the `TcpRlInferenceEnv`, allocates the shm, and wires `TxPktTrace` / `RxPktTrace` callbacks.
- On the first `PktsAcked`, `m_started` flips true and `ScheduleNextStep` queues the first `SendObsGetAction` event for 10 ms later.
- Simultaneously, on node 3, stock `TcpCubic` is running normally. Every 100 ms `WriteCubicMetrics` dumps a row to `/tmp/cubic_metrics.csv`.

**T = 13.01 s.** First SAC step.

- C++ writes a 67-byte `sTcpRlInferenceEnv` struct into shm: `cWnd=3400, rtt_us≈80 000, throughput=some small number, packetLoss=0, segmentSize=340, bytesInFlight≈3400`. `envType=1`.
- `SetCompleted()`.
- Python's `wrapper.step()` unblocks, reads the struct, converts to a dict.
- `obs_dict_to_numpy` normalizes to [0,1].
- `model.predict(obs_np, deterministic=True)` returns, say, `action=[+0.04]` → factor `≈ 1.04`.
- `decode_action`: `new_cWnd = 3400 × 1.04 ≈ 3536`; `new_ssThresh = min(3536*2, ...)`.
- Python writes `{new_cWnd: 3536, new_ssThresh: ...}` into shm. `GetCompleted()`.
- C++ unblocks, stores the new values in `m_new_cWnd` / `m_new_ssThresh`, and `ApplyCwndIfSafe` writes them into `tcb->m_cWnd` immediately (because state is `CA_OPEN`).
- `reward = compute_reward(env)` → some number like 0.21.
- If `step % 5 == 0`, a background thread POSTs a `FlowMetricRequest` to `http://localhost:8080/api/metrics`.

**T = 13.01 s + ~5 ms.** Spring Boot receives the POST.

- `flowMetricService.recordFlowMetric(...)` inserts a row into `flow_metrics`.
- `predictionService.generateAndSavePrediction(...)` (predicts from the metrics, persisted).
- `messagingTemplate.convertAndSend("/topic/metrics", dto)` fans out via STOMP.

**T = 13.01 s + ~8 ms.** Browser receives the frame.

- `handleMessage` parses JSON.
- `algorithmType === 'SAC'` → pushes a new point into `sacMetrics`.
- React re-renders `SACPage`'s Recharts components. You see the first dot appear on the SAC RTT/throughput/cwnd lines.

**T = 13 s – 213 s.** This cycle repeats at 100 Hz for SAC and ~10 Hz for CUBIC metrics. Charts scroll right, old points drop off after 100.

**T = 213 s.** ns-3's `Simulator::Stop(200 s)` fires. The process exits gracefully.

- Python's `while True:` loop detects `ns3_proc.poll() is not None` and breaks.
- `shutdown()`: stop `CubicMetricsReader`, `POST /api/experiments/42/end` → COMPLETED, close shm, close log file, print final summary.
- The browser still has the last 100 points for each flow — you can take screenshots for your report.

That's the full story, start to finish.

---

# PART 10 — WHY EACH TECHNOLOGY?

| Tool                                | Why chosen                                                                                                                                         | Realistic alternative      | Trade-off vs alternative                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **ns-3**                            | Gold-standard discrete-event TCP sim, microsecond-accurate. Rich TCP variants (CUBIC, Reno, BBR). Integrates with ns3-ai for RL.                   | **Mininet** (real Linux TCP over veth) | Mininet gives *real* Linux TCP but is much slower, non-deterministic, hard to pair with a python agent at 10 ms steps. |
| **Python / SB3**                    | PyTorch + the best RL library ecosystem. SAC is ~40 lines to use.                                                                                  | C++ libtorch + custom RL   | Way more engineering, identical math, no real runtime win (GIL-free but SAC is not the bottleneck).                         |
| **Spring Boot + JPA + H2**          | Batteries-included REST + persistence + WebSocket in one binary. File-based DB means no admin.                                                     | Node.js/Express            | Java gives stronger typing, proper DI, enterprise-grade concurrency primitives. Node would need more manual wiring for the STOMP broker. |
| **STOMP over WebSocket (SockJS)**   | Real-time push, browser-friendly, auto-reconnect, SockJS fallback for restrictive networks.                                                        | SSE (Server-Sent Events)   | SSE is one-way and simpler but you'd lose client→server commands should you add them.                                       |
| **React + Recharts + Tailwind**     | Declarative UI with a best-in-class charting lib and utility-first styling.                                                                        | Vue/Angular/plain D3       | Same outcome, bigger learning curve or more boilerplate. React+Recharts is the shortest path from data to pretty charts.    |
| **Shared memory (ns3-ai)**          | ~100 ns round trips; Python/C++ share a packed struct directly.                                                                                    | gRPC/ZeroMQ/localhost TCP  | Any of those add ≥10 µs per call and syscall overhead. SHM is the only option when you must step at 10 ms in simulated time. |

---

# PART 11 — RESULT ANALYSIS

## 11.1 What each metric really means

- **RTT (ms).** Network *latency* as the sender experiences it. Baseline = propagation delay. Excess = queuing delay. **High RTT at steady state ⇒ you are filling queues ⇒ you are a bad citizen on the link.**
- **Throughput (Mbps).** How fast your useful bytes are moving. Upper-bounded by bottleneck ÷ number of active flows. For a single flow on a 2 Mbps link, ceiling is 2 Mbps. Two fairly-shared flows → ceiling is 1 Mbps each.
- **cWnd (bytes).** The sender's idea of "how much is safe to have outstanding." At steady state in BDP terms, optimal `cwnd ≈ BDP = bandwidth × RTT`. For your link ~2500 bytes for one flow, ~1250 each for two flows sharing.
- **Packet loss (count/rate).** Number of drops observed in the interval. Each loss costs a retransmission round and usually triggers a `cwnd` cut.

## 11.2 What you typically see — CUBIC vs SAC

### CUBIC (aggressive / rule-based)

- **Sawtooth `cwnd`** — grows cubically until a drop, then slashes to `β × W_max` (β = 0.7), climbs back toward `W_max`, and probes past it.
- **Periodic RTT spikes** — each probe phase fills the queue, driving RTT up until FqCoDel drops a packet.
- **High average throughput** — near 2 Mbps, because CUBIC is always pushing.
- **Regular loss events** — visible as sudden `cwnd` drops and RTT collapses.

### SAC (learning-based / cautious)

- **Smoother `cwnd`** — the multiplicative factor in [0.8, 1.2] makes transitions gentler.
- **Lower average RTT** — because your reward explicitly penalizes RTT excess quadratically (`excess² × 12`).
- **Somewhat lower average throughput** — the agent trades a few percent of throughput to avoid queuing.
- **Fewer / smaller loss events** — because the agent learned to back off before the queue overflows.

## 11.3 "Why did CUBIC win on throughput?"

Because **you designed the reward to trade throughput for latency.** Specifically:

- `reward_tput = √(throughput / TMAX)` is *concave* — going from 1.5 → 2.0 Mbps is worth less than 0.5 → 1.0 Mbps.
- `penalty_rtt` is *quadratic* — double the queuing delay, quadruple the punishment.

So at the margin, SAC will happily give up 0.1 Mbps to save 20 ms of queuing. CUBIC has no such scruples. In terms of utility functions, **CUBIC optimizes throughput; SAC optimizes a throughput-latency-loss blend.**

## 11.4 Stability vs performance trade-off (the right way to frame it in viva)

- **CUBIC:** near-optimal throughput, high tail latency, periodic packet loss. Great for bulk transfers (big downloads, backups). Bad for real-time traffic.
- **SAC:** slightly lower throughput, much lower and more *stable* RTT, fewer losses. Great for latency-sensitive apps (video call, game, VoIP). The variance is smaller — predictable service quality matters as much as raw speed.
- **Fairness:** FqCoDel equalizes the *slots*, not the *utilization*. A cautious SAC flow sharing with a greedy CUBIC flow might get *less* than half the link, because CUBIC will opportunistically use the slack. This is a known phenomenon; you can demo it in the comparison tab.

---

# PART 12 — PROJECT VALUE (FOR RESUME / VIVA)

## 12.1 Academic importance

You hit an unusually wide range of topics in one project:

- **Computer networks:** TCP internals, congestion control, queueing, AQM, fairness.
- **Machine learning:** reinforcement learning, policy gradients, actor-critic methods, SAC specifics, reward shaping.
- **Systems programming:** discrete-event simulation, shared memory IPC, packed C structs, lock-step IPC.
- **Distributed / backend systems:** REST, JPA, H2, WebSocket/STOMP, pub-sub broker.
- **Frontend:** React hooks, real-time charts, UX for data visualization.
- **DevOps-ish:** Docker Compose, multi-process orchestration, Maven, npm.

## 12.2 Why it's interview-strong

Most candidates can talk about *one* layer — e.g., "I trained a classifier" or "I built a REST API." You can talk credibly about **all** of:

- TCP state machines (`CA_OPEN`, `CA_DISORDER`, `CA_LOSS`, `CA_RECOVERY`).
- Why shared memory beats gRPC at 10 ms steps.
- How SAC differs from PPO / DQN, and why SAC here.
- The specific reward-shaping choices and their effects.
- Why a backend layer isn't overengineering — it's correct factoring.
- The STOMP broker pattern and why it's better than polling.

That *breadth* combined with *depth* is rare and memorable.

## 12.3 Elevator pitch (polish this for a 30-second answer)

> "I built an adaptive TCP congestion controller driven by a deep reinforcement-learning agent. A C++ ns-3 simulation runs a dumbbell network with two TCP flows — one controlled by classical CUBIC, the other by a Soft Actor-Critic policy I trained in PyTorch. ns-3 and the Python agent exchange observations and actions over shared memory every 10 ms, a Spring Boot backend persists and broadcasts the metrics, and a React + WebSocket dashboard shows SAC and CUBIC behavior side-by-side in real time. The goal is to show that a learned policy can match CUBIC on throughput while significantly reducing RTT and packet loss."

---

# PART 13 — ADVANCED UNDERSTANDING (WHERE EXAMINERS PROBE)

## 13.1 Limitations of your current system (be honest — it looks confident)

1. **Fixed reward weights.** `compute_reward` has hard-coded constants (`12.0`, `0.3`, `0.5`, etc.). These were hand-tuned, not learned. Classic RL criticism: you replaced one hand-tuned algorithm (CUBIC) with another (the reward function).
2. **No online learning.** Inference only. A deployment-time distribution shift (new link type, new competing flows) will degrade the policy without any adaptation.
3. **Single bottleneck, fixed topology.** Trained and evaluated on a 2 Mbps / 20 ms dumbbell. Generalization to 1 Gbps data-center or 4G mobile is not demonstrated.
4. **No multi-flow interaction.** Even though `sim_inference.cc` runs SAC *alongside* CUBIC, the policy wasn't necessarily trained under that contention. Fairness behavior may be incidental.
5. **Step period = 10 ms ≈ average RTT.** On higher-BDP networks (1 GB/1 ms DC links) 10 ms is a *huge* number of RTTs; the step granularity would be wrong.
6. **Python-in-the-loop.** The control loop depends on a Python process. A real deployment would require either (a) exporting the policy to ONNX/TorchScript and running in kernel-space eBPF/XDP, or (b) distilling it to a compact rule.
7. **No safety guarantees.** SAC outputs are clipped to [0.8, 1.2], but there is no formal proof that the policy cannot starve other flows or oscillate destructively.

## 13.2 Improvements (good answers for "what would you do with another month?")

- **Domain randomization during training.** Train on randomized bandwidth (0.5–1000 Mbps), delay (1–500 ms), buffer sizes, competing flow counts. Policy generalizes far better.
- **Recurrent / transformer policy.** Current obs is Markovian on 6 features. A recurrent net could exploit temporal patterns (e.g., RTT oscillation period).
- **Curriculum learning.** Start on easy scenarios (single flow, no loss), progressively add competing flows and lossy links.
- **Offline RL on real traces.** Collect real tcpdumps, learn a policy via CQL / IQL, deploy without any real-world trial-and-error.
- **Safety layer.** Wrap the policy in a constraint: "never drive RTT above 2× RTT_min." If the policy tries to, fall back to AIMD.
- **Compare vs BBR.** BBRv2 is the current SOTA baseline. A SAC-vs-BBR comparison is much stronger than SAC-vs-CUBIC alone.
- **Replace H2 with PostgreSQL/TimescaleDB.** For long experiments, time-series DB gives you free windowed aggregates.
- **Deploy as a Linux kernel module** via `TCP_CONG` + an ML inference hook.

## 13.3 Real-world applications

- **5G RAN schedulers** — the radio layer has dynamic capacity; a learned controller can track channel variation.
- **Data center fabrics** — RDMA / RoCE congestion control (DCQCN) is notoriously fragile; RL approaches (HPCC, AuTO) are active research areas.
- **CDN edge servers** — Cloudflare, Akamai, Netflix all tune congestion control per-region. A learning controller could do this per-flow.
- **Satellite / LEO networks** — Starlink's up-and-down path changes every few seconds. Hand-tuned CUBIC is terrible here.
- **Cellular uplink** — mobile networks have bufferbloat and rapidly changing capacity; learned controllers (e.g., Aurora, PCC-RL, Sage) have shown 20–50 % QoE gains.

## 13.4 Likely viva questions — have a 2-sentence answer ready for each

1. "Why SAC and not PPO?" → Off-policy sample efficiency; continuous actions; entropy-driven exploration.
2. "What if the reward function is wrong?" → Admit the fragility; point to the stability bonus; discuss inverse RL / preference-based alternatives.
3. "How is fairness handled?" → FqCoDel at the bottleneck + per-flow queues; not learned explicitly.
4. "Why 10 ms steps?" → Matches training; ≈ ¼ RTT so the agent sees multiple ACKs per step; ns3-ai shm easily keeps up.
5. "What's in shared memory?" → Two packed structs (`sTcpRlInferenceEnv` 67 bytes, `TcpRlInferenceAct` 8 bytes) plus a condition variable, keyed on SHM id 2333.
6. "Why is the backend not optional?" → Persistence + fan-out + decoupling; prevents Python/React coupling.
7. "Why WebSocket over REST polling?" → Push semantics, sub-ms delivery, no wasted requests.
8. "Why `deterministic=True` at inference?" → Entropy is for exploration during training; deployment wants the learned mean.
9. "Why is cwnd only modified in `CA_OPEN` / `CA_DISORDER`?" → ns-3 asserts `BytesInFlight ≤ 1 MSS` in `CA_LOSS` / `CA_RECOVERY`; writing there would crash the sim.
10. "What is BDP and why does it matter?" → Bandwidth × RTT = ideal cwnd for 100 % utilization with zero queuing. Your reward's Gaussian stability bonus centers on BDP exactly for this reason.

---

# ASCII CHEAT-SHEET (PRINT THIS ONE PAGE FOR VIVA)

```
┌─────────────────────────────────────────────────────────────────┐
│  GOAL : learn a TCP congestion controller via SAC RL            │
│  WIN  : lower RTT & loss at comparable throughput vs CUBIC      │
├─────────────────────────────────────────────────────────────────┤
│  STATE (6): cWnd, rtt_us, throughput, loss, segSize, bytesInFlt │
│  ACTION  : factor ∈ [0.8, 1.2] → new_cWnd = cWnd × factor       │
│  REWARD  : √tput − (RTT_excess)²·12 − loss_penalty + stability  │
│  ALGO    : Soft Actor-Critic, stable-baselines3, deterministic  │
├─────────────────────────────────────────────────────────────────┤
│  TOPO    : dumbbell, 2 Mbps / 20 ms / FqCoDel 100p              │
│  FLOWS   : node2=SAC (port 9), node3=CUBIC (port 10)            │
│  STEP    : 10 ms, lock-stepped via ns3-ai SHM id 2333           │
├─────────────────────────────────────────────────────────────────┤
│  STACK   : ns-3 ⇄ Python (shm) → Spring (HTTP) → React (STOMP/WS)│
│  PERSIST : H2 → Experiment 1-N Flow 1-N FlowMetric              │
└─────────────────────────────────────────────────────────────────┘
```

---

*End of document.*
