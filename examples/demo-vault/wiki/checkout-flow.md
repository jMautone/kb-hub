---
title: Checkout flow
tags: [checkout, payments, coupons]
updated: 2026-11-04
sources:
  - raw/inbox/2026-10-21-coupon-applied-twice-on-retry.md
  - raw/inbox/2026-11-03-checkout-timeout-in-payment-sandbox.md
---

# Checkout flow

The storefront checkout of Mate & Co. runs in four steps: cart review, shipping, payment and confirmation. The `checkout-service` owns steps 2 to 4; the cart lives in `cart-service`.

## How a payment goes through

1. The browser posts the cart to `POST /checkout` and gets a `checkout_id`.
2. Coupons are applied once, server side, when the `checkout_id` is created. See [[incident-2026-10-coupon-applied-twice]] for why.
3. The payment step calls the provider with an idempotency key equal to the `checkout_id`.
4. The provider webhook marks the order as paid. The confirmation page polls `GET /checkout/:id` every 2 seconds for up to 60 seconds.

## Known traps

- The payment provider sandbox answers slowly on Mondays; timeouts there are not bugs.
- Refunds follow the [[refund-policy]], which is not written yet.
- Terms are defined in the [[payments-glossary|payments glossary]].
