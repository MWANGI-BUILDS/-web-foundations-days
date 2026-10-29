# Reflection

The most difficult concept for me was concurrency: two people can see the same seat as available and try to reserve it at nearly the same time. I worked through it by separating what the interface displays from what the database guarantees. The seat map is only a snapshot; a conditional update inside a transaction decides who actually gets the hold. Row locking, a hold expiration, and a unique constraint on issued tickets make the outcome easier to reason about, including when a request is retried.

Based on the feedback I received, I would improve the capstone's explanation of peak traffic and how the waiting room protects the database. I would make the assumptions behind the averages more visible and show how a burst can be much larger than an average request rate. I would also add a sequence diagram for the hold-to-payment flow, especially the case where a payment confirmation arrives after a hold expires.

Next, I want to learn more about distributed systems in practice: measuring queue latency, designing idempotent payment workflows, and testing race conditions with concurrent requests. I would apply that learning by building a small reservation prototype and checking that simultaneous attempts never issue more than one ticket for a seat.
