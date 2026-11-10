---
title: Checkout timeout in the payment sandbox
tags: [checkout, payments]
captured_at: "2026-11-03T10:15:00-03:00"
provenance:
  repo: mate-and-co/storefront
  branch: feature/4790-payment-timeouts
  commit: 77ab210
  work_item: "4790"
---

The confirmation page gave up after 60 seconds while the sandbox took up to 90 to send the webhook. Not a bug in production, but tests against the sandbox need a longer timeout. Raised the test timeout only.
