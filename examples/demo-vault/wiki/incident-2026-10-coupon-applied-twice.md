---
title: "Incident 2026-10: coupon applied twice"
tags: [incident, coupons, checkout]
updated: 2026-10-22
sources:
  - raw/inbox/2026-10-21-coupon-applied-twice-on-retry.md
---

# Incident 2026-10: coupon applied twice

**What happened.** On 21 October, customers who retried a failed payment got their coupon discount applied a second time.

**Root cause.** The coupon was applied on every `POST /checkout/:id/pay`, not once per checkout.

**Fix.** Coupons are now applied when the checkout is created. See [[checkout-flow]].

**Work item:** 4730.
