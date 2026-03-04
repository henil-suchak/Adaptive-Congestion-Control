package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
)

func startTCPServer() {

	listener, err := net.Listen("tcp", ":9000")
	if err != nil {
		panic(err)
	}

	fmt.Println("🚀 Agent listening on port 9000")

	for {
		conn, _ := listener.Accept()

		go handleConnection(conn)
	}
}

func handleConnection(conn net.Conn) {
	defer conn.Close()

	scanner := bufio.NewScanner(conn)

	for scanner.Scan() {
		line := scanner.Text()

		var metric FlowMetric
		if err := json.Unmarshal([]byte(line), &metric); err == nil {

			fmt.Printf("📡 Flow=%d Throughput=%.2fMbps Delay=%.2fms\n",
				metric.FlowId,
				metric.ThroughputMbps,
				metric.MeanDelayMs)

			action, rate, ok := sendMetricToBackend(metric)

if ok {
    response := map[string]any{
        "action":          action,
        "recommendedRate": rate,
    }

    json.NewEncoder(conn).Encode(response)

    fmt.Printf("📤 Sent Decision Back → Flow=%d | %s %.2f Mbps\n",
        metric.FlowId,
        action,
        rate,
    )
}
		}
	}
}
