package main

type FlowMetric struct {
	FlowId         uint32  `json:"flowId"`
	Timestamp      float64 `json:"timestamp"`
	SourceIp       string  `json:"sourceIp"`
	DestinationIp  string  `json:"destinationIp"`
	TxPackets      uint64  `json:"txPackets"`
	RxPackets      uint64  `json:"rxPackets"`
	LostPackets    uint64  `json:"lostPackets"`
	ThroughputMbps float64 `json:"throughputMbps"`
	MeanDelayMs    float64 `json:"meanDelayMs"`
	CwndBytes        float64 `json:"cwndBytes"`
}