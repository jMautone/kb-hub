---
title: Payments glossary
tags: [payments, glossary]
updated: 2026-10-30
sources: []
---

# Payments glossary

- **Checkout ID:** the identifier of one checkout attempt. Also used as the idempotency key with the payment provider.
- **Capture:** the moment the provider actually takes the money, after authorization.
- **Chargeback:** the customer's bank reverses a payment. Different from a **refund**, which Mate & Co. starts.
- **Coupon stack:** applying more than one coupon to the same cart. Not allowed.
- **Webhook:** the provider's call back to `checkout-service` saying a payment changed state.
