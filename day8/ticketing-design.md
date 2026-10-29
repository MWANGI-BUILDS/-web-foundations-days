# TicketHub Design

## 1. Requirements

### Functional requirements

- Visitors can browse and search events, view event details, and see seat availability.
- Registered users can select seats, hold available seats temporarily, pay for an order, and view their tickets.
- Users can view and cancel eligible unpaid orders. Expired holds are released automatically.
- The system sends a ticket confirmation after payment succeeds and provides a support path for failed or delayed payments.
- Event organizers can publish events, configure seat maps and prices, and see sales totals.

### Non-functional requirements

- **Speed:** Event listings and seat maps should load in about 2 seconds under normal conditions. During a major sale, queueing and admission control should keep accepted requests responsive rather than letting the service fail.
- **Correctness:** A seat can have at most one active hold and at most one valid ticket. Orders and payment updates must be idempotent so retries do not create duplicate charges or tickets. The database is the authority for seat ownership.
- **Fairness:** At sale opening, requests enter a waiting room and are admitted in queue order at a controlled rate. Use signed, short-lived queue tokens, limit each account to one active hold for an event, and apply per-account and per-IP rate limits. A hold lasts five minutes, giving admitted customers time to complete checkout without allowing indefinite seat blocking.
- **Availability and recovery:** The browsing path can remain available if checkout is overloaded. Payment callbacks are retried safely, and expired holds are reclaimed even after a worker interruption.
- **Security:** Authenticate account actions, authorize access to orders and tickets, validate payment-provider callbacks, and avoid exposing personal or payment details in public APIs.

## 2. Traffic Estimates

Assume 86,400 seconds per day and use daily averages for normal traffic. Peak traffic is bursty, so averages do not describe the instantaneous maximum.

### Normal day

- Page views: 50,000 visitors/day × 10 pages = **500,000 page views/day**.
- Average page-view rate: 500,000 ÷ 86,400 = **about 5.8 page views/second**.
- Tickets sold: 5,000/day ÷ 86,400 = **about 0.058 tickets/second**, or one every 17 seconds on average.
- The 2 million registered users are the account population; the provided 50,000 daily visitors are the traffic basis, not an assumed daily-active percentage.

### Popular concert sale

- Demand: 200,000 people for 20,000 seats in 10 minutes, or **20,000 attempts/minute (about 333/second)** if evenly distributed.
- Inventory throughput: 20,000 seats ÷ 600 seconds = **about 33 tickets/second** if every seat sells evenly throughout the ten minutes.
- There are **10 people per seat**. Even with evenly distributed arrivals, at most 10% of the interested people can buy; actual request bursts may be higher than the 333/second average.
- The sale's average successful-ticket rate is about **576 times** the normal daily-average ticket rate (33.3 ÷ 0.058). Its attempted-checkout rate is much higher than normal sales traffic, although its page-view rate cannot be calculated from the supplied data.

This comparison calls for independently scalable browsing and checkout, a waiting room to smooth arrival bursts, and atomic database operations for the scarce seats. Do not treat 333 requests/second as a guaranteed upper bound; provision capacity and admission control for sharper short-lived spikes.

## 3. API

All endpoints use HTTPS. Account-specific endpoints require authentication. Mutating requests accept an idempotency key so safe client retries do not repeat an operation.

| Method and endpoint | Purpose |
|---|---|
| `GET /api/events?query=&date=&cursor=` | Browse/search published events with cursor pagination. |
| `GET /api/events/{eventId}` | Read event details, venue, sale status, and pricing information. |
| `GET /api/events/{eventId}/seats` | Read the seat map and current availability; availability is informational and may change before a hold succeeds. |
| `POST /api/events/{eventId}/holds` | Request one or more seat holds. Requires a valid sale-queue token; returns the hold/order ID and expiry or a conflict if a seat is no longer available. |
| `POST /api/orders/{orderId}/payment-intent` | Start payment for the authenticated user's unexpired order; returns provider checkout details. |
| `POST /api/payments/webhook` | Receive signed, idempotently processed payment-provider updates. |
| `GET /api/me/tickets` | List the authenticated user's issued tickets. |
| `GET /api/me/orders/{orderId}` | Read the authenticated user's order and payment status. |

The hold endpoint validates the whole requested seat set and reserves it in one database transaction: if any requested seat cannot be held, none are held. Checkout results do not issue tickets directly from the browser; verified payment confirmation does.

## 4. Data Model

Use a relational database for transactional seat allocation and referential integrity. The core tables are:

- **`users`** (`id` primary key, `email` unique, `created_at`): registered accounts.
- **`events`** (`id` primary key, `organizer_id` foreign key to `users`, `title`, `venue`, `starts_at`, `sale_opens_at`, `status`): event and sale details. One event has many seats and orders.
- **`seats`** (`id` primary key, `event_id` foreign key to `events`, `section`, `row_label`, `seat_number`, `price`, `status`, `held_by_order_id` nullable foreign key to `orders`, `hold_expires_at` nullable): inventory. Add a unique constraint on `(event_id, section, row_label, seat_number)`. One event has many seats.
- **`orders`** (`id` primary key, `user_id` foreign key to `users`, `event_id` foreign key to `events`, `status`, `idempotency_key`, `created_at`, `hold_expires_at`): checkout attempt and its lifecycle. Add a unique constraint on `(user_id, idempotency_key)`. One user and event can each have many orders; an order belongs to one user and one event.
- **`order_items`** (`id` primary key, `order_id` foreign key to `orders`, `seat_id` foreign key to `seats`, `price_at_purchase`): seats selected for an order. Add a unique constraint on `(order_id, seat_id)`; retain canceled/expired rows for order history.
- **`tickets`** (`id` primary key, `order_item_id` unique foreign key to `order_items`, `event_id` foreign key to `events`, `seat_id` foreign key to `seats`, `issued_at`, `status`): issued tickets. Add a unique constraint on `seat_id` so only one ticket can ever be issued for a seat.

Relationships: users place orders; each order contains order items; each order item identifies a seat; events own seats and orders; a successfully paid order item can produce one ticket. The seat row holds the current reservation state, while the ticket row records the durable sold entitlement.

## 5. Preventing Double-Booking

The database, not a cached seat map or an application-server check, decides whether a seat is available. To create a hold, start a transaction and conditionally update each seat row only if it is available or its previous hold has expired. Lock the rows in a consistent order, then create the order and order items and set each seat's `held_by_order_id` and `hold_expires_at` before committing. A conditional update such as `UPDATE seats SET ... WHERE id = ? AND (status = 'available' OR (status = 'held' AND hold_expires_at <= now()))` must affect exactly one row per requested seat. If any row cannot be claimed, roll back the entire transaction and return a conflict.

Concurrent requests for the same seat serialize on its database row: only one can satisfy the availability condition and commit a hold. The other sees that the seat is held and fails. On verified payment success, a transaction checks that the order still owns unexpired holds, marks the order paid, changes the seats to sold, and inserts tickets. The unique `tickets.seat_id` constraint is a final guard against duplicate issuance. If payment arrives after a hold expired or was reassigned, do not issue tickets; send the order to a reconciliation/refund path. Payment webhooks and client retries use idempotency keys to prevent duplicate processing.

An expiration worker releases expired seats only when they are still held by the same order and the hold is still expired. This conditional release prevents an old cleanup task from clearing a newer customer's hold.

## 6. Architecture

```text
                         +----------------------+
                         | Web / mobile clients |
                         +----------+-----------+
                                    |
                          +---------v----------+
                          | CDN: static assets |
                          +---------+----------+
                                    |
                          +---------v----------+
                          | WAF / load balancer|
                          +----+-----------+---+
                               |           |
                    browse     |           | checkout
                    +----------v--+    +---v----------------+
                    | Event API   |    | Waiting room /     |
                    | stateless   |    | admission control  |
                    +------+------+\   +---------+----------+
                           |       \              |
                   +-------v--+    +--------------v---------+
                   | Cache    |    | Ticket / order API     |
                   | listings |    | stateless instances    |
                   +----+-----+    +--+------------------+--+
                        |             |                  |
                 +------v------+  +---v--------+   +-----v----------+
                 | Read replica|  | Queue      |   | Relational DB  |
                 | event reads|  | payment &   |   | primary: seats|
                 +-------------+  | expiry work|   | orders, tickets|
                                  +---+--------+   +-----+----------+
                                      |                  |
                         +------------v----+     +-------v-----------+
                         | Workers: expiry,|     | Payment provider  |
                         | webhook retries |     | + signed webhooks|
                         +-----------------+     +-------------------+
```

### Components and sale behavior

- **Clients and CDN:** Clients use the CDN for static assets. Cached event descriptions and seat-map layout reduce repeated origin reads; seat availability shown from cache is advisory, never a reservation.
- **WAF/load balancer:** Filters abusive traffic and distributes requests across stateless service instances.
- **Event API, cache, and read replica:** Browse and event-detail reads scale horizontally and use cache/replica capacity, keeping most sale traffic away from the write primary.
- **Waiting room/admission control:** Issues signed queue tokens and admits checkout attempts at a rate the reservation database and payment integration can handle. It can pause admissions during an incident while users retain their queue position.
- **Ticket/order API and relational primary:** Performs authoritative transactional holds, order changes, and ticket issuance. A single logical writer for seat allocation avoids conflicting inventory decisions; database constraints protect the invariants even under concurrent API instances.
- **Queue and workers:** Buffer payment follow-up and hold-expiration work. Retries are idempotent, and workers release only holds still owned by the expired order.
- **Payment provider:** Handles payment details outside TicketHub's database. Signed webhooks update order status through the same idempotent order-processing path.

During a big sale, the waiting room smooths the 200,000-person arrival, cached browsing reduces primary reads, and horizontal stateless services scale with admitted traffic. The database still serializes competing claims for each seat, preserving correctness even if requests arrive together. Monitor queue wait, hold conflicts, database lock/CPU pressure, payment latency, and remaining inventory to adjust admission safely.

## 7. Trade-offs

- **Fairness queue versus immediate access:** Queueing and controlled admission reduce overload and make access more orderly, but add waiting time and operational complexity. A strict FIFO queue is fairer in arrival order but can be harder to operate across reconnects; signed queue positions and clear retry behavior help.
- **Short seat holds versus checkout time:** Five-minute holds limit the time inventory is unavailable to other buyers, but can expire during a slow payment flow. Longer holds are friendlier to buyers but reduce available inventory and increase abandonment risk. The system should clearly show expiry and release seats reliably.
- **Cached availability versus freshness:** Caching event and seat-map data reduces database load and improves response time, but availability can become stale. Treat it as a preview and confirm every hold against the primary database.
- **Single authoritative writer versus write scaling:** A primary writer makes seat transactions easier to reason about, but can limit write throughput and become a bottleneck. Scale reads separately and use admission control first; partitioning inventory across independent event partitions can be considered later, with care to preserve per-seat transaction guarantees.
