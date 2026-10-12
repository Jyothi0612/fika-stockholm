// kitchen: the worker that "bakes" each paid order. It has no port: it only reads the
// RabbitMQ "orders" queue, so orders wait safely in the queue whenever the kitchen is down.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type item struct {
	Name string `json:"name"`
	Qty  int    `json:"qty"`
}

type order struct {
	OrderID   string `json:"orderid"`
	User      string `json:"user"`
	Items     []item `json:"items"`
	Total     int    `json:"total"`
	RequestID string `json:"requestId"`
	Delivery  struct {
		Mode     string `json:"mode"`
		Cafe     string `json:"cafe"`
		District string `json:"district"`
		Minutes  int    `json:"minutes"`
	} `json:"delivery"`
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

var client = &http.Client{Timeout: 5 * time.Second}

// report tells the user service how the order is going, so the customer sees it live.
// Retries a few times; if the user service is down, the order is still baked (the log says so).
func report(log *slog.Logger, o order, status map[string]any) {
	url := fmt.Sprintf("http://%s:%s/order/%s/%s/status", env("USER_HOST", "localhost"), env("USER_PORT", "8080"), o.User, o.OrderID)
	body, _ := json.Marshal(status)
	for try := 1; try <= 3; try++ {
		req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Request-Id", o.RequestID)
		res, err := client.Do(req)
		if err == nil {
			res.Body.Close()
			if res.StatusCode < 300 {
				return
			}
			err = fmt.Errorf("user service answered %d", res.StatusCode)
		}
		log.Warn("could not report status, retrying", "orderid", o.OrderID, "status", status["status"], "try", try, "error", err.Error())
		time.Sleep(time.Second)
	}
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", "kitchen")
	url := fmt.Sprintf("amqp://%s:%s@%s:5672/", env("AMQP_USER", "guest"), env("AMQP_PASS", "guest"), env("AMQP_HOST", "localhost"))
	for {
		if err := run(url, log); err != nil {
			log.Error("lost connection to RabbitMQ, retrying in 5s", "host", env("AMQP_HOST", "localhost"), "error", err.Error())
		}
		time.Sleep(5 * time.Second)
	}
}

func run(url string, log *slog.Logger) error {
	conn, err := amqp.DialConfig(url, amqp.Config{Dial: amqp.DefaultDial(5 * time.Second)})
	if err != nil {
		return err
	}
	defer conn.Close()
	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	if _, err = ch.QueueDeclare("orders", true, false, false, false, nil); err != nil {
		return err
	}
	_ = ch.Qos(1, 0, false)
	msgs, err := ch.Consume("orders", "kitchen", false, false, false, false, nil)
	if err != nil {
		return err
	}
	log.Info("connected to RabbitMQ, waiting for orders", "queue", "orders")
	for m := range msgs {
		var o order
		if err := json.Unmarshal(m.Body, &o); err != nil {
			log.Error("bad message, dropping it", "error", err.Error())
			_ = m.Nack(false, false)
			continue
		}
		n := 0
		for _, it := range o.Items {
			n += it.Qty
		}
		log.Info("order received", "orderid", o.OrderID, "user", o.User, "items", n, "total", o.Total, "cafe", o.Delivery.Cafe, "requestId", o.RequestID)
		report(log, o, map[string]any{"status": "preparing"})
		time.Sleep(time.Duration(3+n) * time.Second) // "baking": a few seconds in the demo
		if o.Delivery.Mode == "pickup" {
			code := fmt.Sprintf("FIKA-%04d", rand.Intn(10000))
			log.Info("order ready for pickup", "orderid", o.OrderID, "pickupCode", code)
			report(log, o, map[string]any{"status": "ready for pickup", "pickupCode": code})
		} else {
			log.Info("order out for delivery by bike", "orderid", o.OrderID, "district", o.Delivery.District, "etaMinutes", o.Delivery.Minutes)
			report(log, o, map[string]any{"status": "on the way", "etaMinutes": o.Delivery.Minutes})
			go func(o order) { // the demo bike arrives after a short ride
				time.Sleep(20 * time.Second)
				log.Info("order delivered", "orderid", o.OrderID, "district", o.Delivery.District)
				report(log, o, map[string]any{"status": "delivered"})
			}(o)
		}
		_ = m.Ack(false)
	}
	return fmt.Errorf("channel closed")
}
