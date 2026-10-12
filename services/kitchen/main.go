// kitchen: the worker that "bakes" each paid order. It has no port: it only reads the
// RabbitMQ "orders" queue, so orders wait safely in the queue whenever the kitchen is down.
package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
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
		time.Sleep(time.Duration(300*n) * time.Millisecond) // "baking"
		if o.Delivery.Mode == "pickup" {
			log.Info("order ready for pickup", "orderid", o.OrderID, "pickupCode", fmt.Sprintf("FIKA-%04d", rand.Intn(10000)))
		} else {
			log.Info("order out for delivery by bike", "orderid", o.OrderID, "district", o.Delivery.District, "etaMinutes", o.Delivery.Minutes)
		}
		_ = m.Ack(false)
	}
	return fmt.Errorf("channel closed")
}
