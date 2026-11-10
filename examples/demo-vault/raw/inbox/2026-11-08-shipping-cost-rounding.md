---
title: Shipping cost rounding differs between cart and checkout
tags: [shipping, bug]
captured_at: "2026-11-08T18:03:44-03:00"
provenance:
  repo: mate-and-co/storefront
  branch: bugfix/4821-shipping-rounding
  commit: 9f3c2ab
  work_item: "4821"
---

The cart shows shipping rounded to two decimals, but checkout rounds half-even, so some totals differ by one cent. Open question: which one does finance expect? Asked in the team channel, no answer yet.
