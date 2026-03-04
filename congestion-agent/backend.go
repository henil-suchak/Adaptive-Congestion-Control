package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
)

const BackendURL = "http://localhost:8080/api"

var experimentID int64
var flowMap = map[uint32]int64{}
var flowMapMutex sync.Mutex
func createExperiment() {

	payload := map[string]any{
		"name":                    "ns3-live-exp",
		"topology":                "dumbbell",
		"bottleneckBandwidthMbps": 10,
		"baseDelayMs":             20,
		"queueType":               "DROP_TAIL",
	}

	data, _ := json.Marshal(payload)

	resp, err := http.Post(
		BackendURL+"/experiments",
		"application/json",
		bytes.NewBuffer(data),
	)

	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	var result struct {
		ExperimentId int64 `json:"experimentId"`
	}

	json.NewDecoder(resp.Body).Decode(&result)
	experimentID = result.ExperimentId

	http.Post(
		fmt.Sprintf("%s/experiments/%d/start", BackendURL, experimentID),
		"application/json",
		bytes.NewBuffer([]byte{}),
	)

	fmt.Println("✅ Experiment Started:", experimentID)
}

func createFlow(ns3Flow uint32, src, dst string) int64 {

	payload := map[string]any{
		"sender":   src,
		"receiver": dst,
		"protocol": "TCP",
	}

	data, _ := json.Marshal(payload)

	resp, err := http.Post(
		fmt.Sprintf("%s/experiments/%d/flows", BackendURL, experimentID),
		"application/json",
		bytes.NewBuffer(data),
	)

	if err != nil || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		fmt.Println("❌ Flow creation failed:", string(body))
		return -1
	}
	defer resp.Body.Close()

	var result struct {
		FlowId int64 `json:"flowId"`
	}

	json.NewDecoder(resp.Body).Decode(&result)

	flowMapMutex.Lock()
flowMap[ns3Flow] = result.FlowId
flowMapMutex.Unlock()

	fmt.Println("✅ Flow Created:", ns3Flow, "→", result.FlowId)

	return result.FlowId
}

func sendMetricToBackend(m FlowMetric) (string, float64, bool) {

	flowMapMutex.Lock()
backendFlow, exists := flowMap[m.FlowId]
flowMapMutex.Unlock()

	if !exists {
		backendFlow = createFlow(m.FlowId, m.SourceIp, m.DestinationIp)
		if backendFlow < 0 {
			return "", 0, false
		}
	}

	packetLossRate := 0.0
	if m.TxPackets > 0 {
		packetLossRate = float64(m.LostPackets) / float64(m.TxPackets)
	}

	payload := map[string]any{
		"rttMs":           m.MeanDelayMs,
		"throughputMbps":  m.ThroughputMbps,
		"packetLossRate":  packetLossRate,
		"cwndBytes":       m.CwndBytes, 
		"sendingRateMbps": m.ThroughputMbps,
	}

	data, _ := json.Marshal(payload)

	resp, err := http.Post(
    fmt.Sprintf("%s/flows/%d/metrics", BackendURL, backendFlow),
    "application/json",
    bytes.NewBuffer(data),
)

if err != nil {
    fmt.Println("❌ Metric send error:", err)
    return "", 0, false
}
defer resp.Body.Close()

// 🔥 Read backend decision
var decision struct {
    Action          string  `json:"action"`
    RecommendedRate float64 `json:"recommendedRate"`
}

if err := json.NewDecoder(resp.Body).Decode(&decision); err != nil {
    fmt.Println("❌ Failed to decode decision:", err)
    return "", 0, false
}

fmt.Printf("🧠 ML Decision → Flow %d | Action: %s | RecommendedRate: %.2f Mbps\n",
    backendFlow,
    decision.Action,
    decision.RecommendedRate,
)

return decision.Action, decision.RecommendedRate, true
}