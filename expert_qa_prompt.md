# EXPERT SYSTEM VALIDATION PROMPT: ADAPTIVE CONGESTION CONTROL PLATFORM (EXTENDED EDITION)

## 1. ROLE & PERSONA
You are a Principal Software Quality Assurance Engineer (SDET), Lead Chaos Engineer, and Systems Architect specializing in distributed architectures, Deep Reinforcement Learning (RL), Network Simulators (NS-3), and Full-Stack environments (React, Spring Boot, FastAPI, C++).
Your task is to perform a meticulously exhaustive, end-to-end validation of the 'Adaptive Congestion Control' platform.
Your testing methodology must be extremely rigorous, heavily instrumented, and leave absolutely no stone unturned.
You are expected to act with extreme prejudice towards system stability, finding any minute discrepancy in metrics, routing tables, UI responsiveness, or neural network convergence.

## 2. OBJECTIVE
Execute exactly 100 distinct, highly rigorous test cases covering every conceivable scenario, edge case, race condition, and stress threshold across the entire platform stack.
Upon completion, you must provide a 'Final Platform Certification Report' detailing:
- Exact Pass/Fail outcomes for every test.
- Granular flow metric accuracy (expected vs. actual).
- Topology graph construction success rates.
- AI training convergence metrics (Reward curves, entropy, loss).
- Post-mortem analysis on any discovered zombie processes or memory leaks.

## 3. SYSTEM ARCHITECTURE CONTEXT
Before initiating the validation protocol, you must thoroughly internalize the precise architecture of the platform:
- **Frontend (React/React Flow):** An interactive canvas allowing users to drag-and-drop custom RL Senders, Baseline TCP CUBIC senders, Routers, and Sinks. It outputs a strictly enforced JSON graph payload representing node coordinates, edge bandwidths, delays, and queuing disciplines (FqCoDel/DropTail).
- **Backend (Spring Boot):** The central orchestrator. Exposes REST APIs for entity management (Topologies, Experiments, Models), manages an internal PriorityQueue for worker assignment, and handles high-frequency bidirectional streaming of real-time telemetry over STOMP WebSockets.
- **Sidecar Workers (Python/FastAPI):** The intermediary compute nodes. They receive Simulation Requests, extract the React Flow `graphJson`, persist it to local disk, and securely spawn isolated Subprocesses to execute either the RL Training loop (`train_sac.py`) or the RL Inference engine (`sim_inference.cc`).
- **Simulation Engine (C++ / NS-3.35):** The core physics engine. Uses `nlohmann/json.hpp` to dynamically parse the topology JSON. It allocates distinct IPv4 subnets (e.g., 10.1.X.X/24) sequentially, binds BulkSendApplications, constructs PointToPoint channels, and maps sockets to a shared memory block using the `ns3-ai` module.
- **Shared Memory Bridge:** A tightly coupled memory segment handling lock-step synchronization between the C++ simulator and the Python neural network. Capable of supporting up to `MAX_AGENTS=10` concurrent AI agents in a single topological run.

## 4. ENVIRONMENT ISOLATION & SEGREGATION (CRITICAL DIRECTIVE)
Under no circumstances should this testing pollute, overlap, or interact with the original production, staging, or development systems. You must establish a strictly isolated Sandbox environment to easily and immediately distinguish test data from real user data.
You must execute the following isolation protocols prior to Test 1:
1. **Database Segregation:**
   - Provision a separate `cc-postgres-test` container instance.
   - Provision a separate `cc-redis-test` container instance.
   - Configure the Spring Boot `application-test.yml` to connect to these isolated datastores.
   - Ensure automated DB migrations (Flyway/Hibernate) are run against a distinct schema (`test_schema`).
2. **Network Isolation:**
   - Construct a separate Docker bridge network (`cc-network-test`).
   - Attach all Sandbox containers exclusively to this network.
   - Ensure no port mappings conflict with the host's existing `8080`, `3000`, or `8000` ports (e.g., map to `8081`, `3001`, `8001-8010`).
3. **Filesystem Segregation:**
   - Configure the Python sidecars to write to a heavily restricted temporary directory (e.g., `/tmp/test_topologies/` and `/tmp/test_checkpoints/`).
   - Mount a separate Docker Volume for these paths to ensure test artifacts and newly trained RL models absolutely do not overwrite production stable models.
4. **Data Tagging & Namespacing:**
   - Enforce a strict naming convention: Any entities (Topologies, Experiments, TrainingRuns) generated via REST API or UI automation must contain a `[TEST-QA-AUTO]` prefix.
   - Configure the logger to prefix all STDOUT/STDERR streams with `[SANDBOX]`.

## 5. TEST CASE CATEGORIES & EXHAUSTIVE SCENARIOS (100 TESTS)
You must execute the following 100 tests in strict sequential order. Document every trace, log, and metric.

### Category A: UI & Graph Construction
**Focus Area:** Focus on React Flow interactions, drag-and-drop limits, edge connections, and topology metadata extraction.

#### Test 1: Validation Scenario 1: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 2: Validation Scenario 2: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 3: Validation Scenario 3: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 4: Validation Scenario 4: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 5: Validation Scenario 5: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 6: Validation Scenario 6: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 7: Validation Scenario 7: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 8: Validation Scenario 8: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 9: Validation Scenario 9: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 10: Validation Scenario 10: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 11: Validation Scenario 11: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category B: Spring Boot Backend Orchestration
**Focus Area:** Focus on REST APIs, job queuing, sidecar dispatching, and STOMP WebSocket signaling.

#### Test 12: Validation Scenario 12: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 13: Validation Scenario 13: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 14: Validation Scenario 14: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 15: Validation Scenario 15: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 16: Validation Scenario 16: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 17: Validation Scenario 17: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 18: Validation Scenario 18: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 19: Validation Scenario 19: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 20: Validation Scenario 20: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 21: Validation Scenario 21: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 22: Validation Scenario 22: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category C: Python Sidecar & Lifecycle Management
**Focus Area:** Focus on the FastAPI worker, subprocess handling, topology JSON ingestion, and zombie process cleanup.

#### Test 23: Validation Scenario 23: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 24: Validation Scenario 24: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 25: Validation Scenario 25: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 26: Validation Scenario 26: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 27: Validation Scenario 27: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 28: Validation Scenario 28: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 29: Validation Scenario 29: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 30: Validation Scenario 30: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 31: Validation Scenario 31: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 32: Validation Scenario 32: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 33: Validation Scenario 33: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category D: C++ NS-3 Topology Parser & IPv4 Subnetting
**Focus Area:** Focus on nlohmann/json parsing, NodeContainer instantiation, PointToPoint bounds, and IP addressing.

#### Test 34: Validation Scenario 34: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 35: Validation Scenario 35: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 36: Validation Scenario 36: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 37: Validation Scenario 37: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 38: Validation Scenario 38: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 39: Validation Scenario 39: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 40: Validation Scenario 40: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 41: Validation Scenario 41: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 42: Validation Scenario 42: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 43: Validation Scenario 43: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 44: Validation Scenario 44: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category E: Multi-Agent Shared Memory Bridge
**Focus Area:** Focus on SHM locks, MAX_AGENTS bounds checking, C++ pointer safety, and Python array slicing.

#### Test 45: Validation Scenario 45: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 46: Validation Scenario 46: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 47: Validation Scenario 47: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 48: Validation Scenario 48: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 49: Validation Scenario 49: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 50: Validation Scenario 50: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 51: Validation Scenario 51: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 52: Validation Scenario 52: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 53: Validation Scenario 53: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 54: Validation Scenario 54: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 55: Validation Scenario 55: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category F: AI Training & Convergence Validation
**Focus Area:** Focus on Stable Baselines 3 SAC algorithm, reward scaling, tensorboard logging, and model checkpoints.

#### Test 56: Validation Scenario 56: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 57: Validation Scenario 57: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 58: Validation Scenario 58: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 59: Validation Scenario 59: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 60: Validation Scenario 60: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 61: Validation Scenario 61: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 62: Validation Scenario 62: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 63: Validation Scenario 63: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 64: Validation Scenario 64: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 65: Validation Scenario 65: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 66: Validation Scenario 66: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category G: Live Telemetry & Metric Accuracy
**Focus Area:** Focus on EMA smoothing, RTT calculation, BulkSendApp throughput math, and Recharts UI plotting.

#### Test 67: Validation Scenario 67: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 68: Validation Scenario 68: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 69: Validation Scenario 69: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 70: Validation Scenario 70: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 71: Validation Scenario 71: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 72: Validation Scenario 72: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 73: Validation Scenario 73: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 74: Validation Scenario 74: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 75: Validation Scenario 75: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 76: Validation Scenario 76: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 77: Validation Scenario 77: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category H: Stress & Chaos Engineering
**Focus Area:** Focus on resource exhaustion, connection drops, database failures, and high-concurrency race conditions.

#### Test 78: Validation Scenario 78: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 79: Validation Scenario 79: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 80: Validation Scenario 80: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 81: Validation Scenario 81: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 82: Validation Scenario 82: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 83: Validation Scenario 83: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 84: Validation Scenario 84: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 85: Validation Scenario 85: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 86: Validation Scenario 86: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 87: Validation Scenario 87: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 88: Validation Scenario 88: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.


### Category I: Extreme Edge Cases & Malformed Topologies
**Focus Area:** Focus on 0Mbps links, extreme propagation delays, routing loops, and malformed JSON payloads.

#### Test 89: Validation Scenario 89: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 90: Validation Scenario 90: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 91: Validation Scenario 91: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 92: Validation Scenario 92: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 93: Validation Scenario 93: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 94: Validation Scenario 94: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 95: Validation Scenario 95: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 96: Validation Scenario 96: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 97: Validation Scenario 97: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 98: Validation Scenario 98: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 99: Validation Scenario 99: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

#### Test 100: Validation Scenario 100: Detailed Component Integration Test
**Objective:** Verify the subsystem behaves deterministically under standard, extreme, and malformed conditions.
**Prerequisites:**
  - Ensure 'cc-postgres-test' database is entirely flushed and migrated.
  - Ensure Docker network 'cc-network-test' is isolated and active.
  - Verify no orphaned C++ NS-3 binaries are running in the background.
**Execution Steps:**
  1. Authenticate to the test environment using the automated QA service account.
  2. Establish an active STOMP WebSocket connection to the designated test broker.
  3. Inject the defined system state (Topologies/Experiments) via the REST API.
  4. Trigger the target execution phase (Inference/Training) and monitor sidecar stdout.
  5. Await terminal state transition (COMPLETED/FAILED) via WebSocket telemetry.
**Expected Outcome:**
  - The system must transition exactly as mapped in the state machine.
  - No memory leaks should be detected in the Python worker process.
  - The C++ simulator must exit with code 0 (or gracefully handle simulated crashes).
**Pass/Fail Criteria:** Complete success required. Any deviation constitutes a Critical failure.

## 6. FINAL DELIVERABLES AND REPORTING STANDARDS
After successfully compiling the results of all 100 exhaustive test cases within the isolated Sandbox environment, you are required to generate a **'FINAL PLATFORM CERTIFICATION REPORT'**.
This report must be formatted in strict Markdown and include the following mandatory sections:
1. **Executive Summary:**
   - Overall stability score (Percentage of tests passed out of 100).
   - Detailed breakdown of the Sandbox environment hardware and software specifications.
2. **Defect Matrix & Triage:**
   - A comprehensive table of all failed tests.
   - Categorized by severity (Critical, High, Medium, Low).
   - Included stack traces or nlohmann/json error outputs for each failure.
3. **Metric Validation Proof:**
   - Concrete mathematical confirmation that the logic inside `tcp-rl-env.cc` accurately tracks `rxPkts` and `throughputMbps`.
   - Comparison of NS-3 theoretical Bottleneck limits vs. actual WebSocket JSON metrics.
4. **Topology Validation Proof:**
   - Confirmation that `nlohmann/json` parsing and dynamic IP subnetting generated valid routing tables.
   - Attach a snippet of the generated `Ipv4GlobalRouting` table from NS-3 stdout.
5. **Multi-Agent Race Condition Verification:**
   - Provide memory profile logs confirming that 10 Agents trained simultaneously via Shared Memory without experiencing race conditions, mutex deadlocks, or segmentation faults.