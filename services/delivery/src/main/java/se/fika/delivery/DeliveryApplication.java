package se.fika.delivery;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** delivery service: Stockholm districts live in MySQL (database "stockholm").
 *  Prices a pickup or a bike delivery from a café to a district. Fees and minutes are demo numbers. */
@SpringBootApplication
@RestController
public class DeliveryApplication {
    private static final Logger log = LoggerFactory.getLogger(DeliveryApplication.class);
    private final JdbcTemplate db;
    private final RestClient menu, basket;

    public DeliveryApplication(JdbcTemplate db, @Value("${menu.url}") String menuUrl, @Value("${basket.url}") String basketUrl) {
        this.db = db;
        this.menu = RestClient.create(menuUrl);
        this.basket = RestClient.create(basketUrl);
    }

    public static void main(String[] args) { SpringApplication.run(DeliveryApplication.class, args); }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        boolean mysql;
        try { mysql = db.queryForObject("SELECT 1", Integer.class) == 1; } catch (Exception e) { mysql = false; log.error("MySQL not reachable: " + e.getMessage()); }
        return ResponseEntity.status(mysql ? 200 : 503).body(Map.of("app", "OK", "mysql", mysql));
    }

    @GetMapping("/districts")
    public List<Map<String, Object>> districts() {
        return db.queryForList("SELECT id, name, postcode, lat, lon FROM districts ORDER BY name");
    }

    @GetMapping("/quote/{cafe}/{district}")
    public ResponseEntity<Map<String, Object>> quote(@PathVariable String cafe, @PathVariable int district,
                                                     @RequestParam(defaultValue = "delivery") String mode) {
        Map<String, Object> q = price(cafe, district, mode);
        return q.containsKey("message") ? ResponseEntity.status((int) q.remove("status")).body(q) : ResponseEntity.ok(q);
    }

    /** prices the order and writes it into the basket (called when the customer confirms) */
    @PostMapping("/confirm/{basketId}/{cafe}/{district}")
    public ResponseEntity<Object> confirm(@PathVariable String basketId, @PathVariable String cafe, @PathVariable int district,
                                          @RequestParam(defaultValue = "delivery") String mode) {
        Map<String, Object> q = price(cafe, district, mode);
        if (q.containsKey("message")) return ResponseEntity.status((int) q.remove("status")).body(q);
        try {
            Object b = basket.post().uri("/delivery/{id}", basketId).body(q).retrieve().body(Object.class);
            return ResponseEntity.ok(b);
        } catch (RestClientException e) {
            log.error("basket not reachable: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", "basket not reachable"));
        }
    }

    private Map<String, Object> price(String cafeId, int districtId, String mode) {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> d;
        try {
            d = db.queryForMap("SELECT id, name, postcode, lat, lon FROM districts WHERE id = ?", districtId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            out.put("status", 404); out.put("message", "district not found"); return out;
        } catch (Exception e) {
            out.put("status", 503); out.put("message", "database unavailable"); return out;
        }
        Map<?, ?> cafe;
        try {
            cafe = menu.get().uri("/cafes/{id}", cafeId).retrieve().body(Map.class);
        } catch (RestClientException e) {
            out.put("status", 503); out.put("message", "menu not reachable"); return out;
        }
        double km = haversine(((Number) cafe.get("lat")).doubleValue(), ((Number) cafe.get("lon")).doubleValue(),
                              ((Number) d.get("lat")).doubleValue(), ((Number) d.get("lon")).doubleValue());
        km = Math.round(km * 10) / 10.0;
        boolean pickup = "pickup".equals(mode);
        int minutes = pickup ? 10 : 10 + (int) Math.ceil(km / 15.0 * 60);   // 10 min to prepare, bikes ride ~15 km/h
        int fee = pickup ? 0 : 39 + (int) Math.round(km * 9);               // demo pricing in SEK
        out.put("mode", pickup ? "pickup" : "delivery");
        out.put("cafe", cafe.get("name"));
        out.put("district", d.get("name"));
        out.put("postcode", d.get("postcode"));
        out.put("km", km);
        out.put("minutes", minutes);
        out.put("fee", fee);
        return out;
    }

    private static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double r = 6371, dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * r * Math.asin(Math.sqrt(a));
    }
}
