---
title: Coupon applied twice on retry
tags: [coupons, bug]
captured_at: 2026-10-21T16:42:10-03:00
provenance:
  repo: mate-and-co/storefront
  branch: bugfix/4730-coupon-retry
  commit: 1c8e44f
  work_item: "4730"
---

Customers who retry a failed payment get the coupon discount twice. The discount is applied inside the pay handler, so every retry applies it again. Fix: move coupon application to checkout creation. Test added in checkout.spec.ts.
