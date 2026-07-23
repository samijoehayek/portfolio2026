# Loom script — Vellos architecture walkthrough

**Target length:** ~2:00 · **Goal:** since the platform is no longer live and the code is private, this is a **narrated architecture walkthrough** — screen-share the two case-study diagrams (bonding curve + price pipeline) and explain how it works. It's a "here's the system I built" explainer, not a product demo.

**Before you record**
- Open the two diagrams from the Vellos case-study page (bonding curve, then the pipeline) full-screen, or draw them live on a whiteboard.
- No product to show and nothing confidential to leak — you're explaining mechanics, not clicking a UI.

---

### 0:00–0:15 — Hook
- **Screen:** the bonding-curve diagram (Creator → Factory → Bonding Curve → AMM).
- **Say:** "Vellos is a pump.fun-style fair-launch platform I built on Ethereum. Anyone launches a token and it trades instantly on an on-chain bonding curve — no seeded liquidity, no team allocation. Price is pure supply and demand. Let me show you how it works."

### 0:15–0:45 — Launch + the curve
- **Screen:** point at Factory → Bonding Curve, then the price curve graph.
- **Say:** "A creator hits launch — a factory spins up the token and its curve as a cheap minimal-proxy clone. From the first buy, the token trades on a constant-product curve. As people buy, the price walks up this curve; as they sell, it walks back down. The curve *is* the market — there's no order book and no LP to seed."

### 0:45–1:10 — The math (the wow)
- **Screen:** the formula on the graph (`price = X / Y`, `buy Δy → pay X·Δy/(Y−Δy)`).
- **Say:** "Under the hood it's a constant product — X times Y equals k — but over *virtual* reserves. That's the trick: the virtual reserves mean the price starts at a sensible non-zero value instead of zero, and the curve has an asymptote so it can never be fully drained. To buy Δ tokens you pay X·Δ over (Y minus Δ) — it's the same invariant Uniswap uses, which is exactly why graduation is seamless."

### 1:10–1:30 — Graduation
- **Screen:** point at the graduation dot → AMM Pool.
- **Say:** "When the curve sells out — a fixed threshold of ETH raised — the token *graduates*: the accumulated liquidity migrates into an AMM pool and the LP is locked, so trading continues off the curve with no rug. Because the curve was already a Uniswap-shaped pool, that migration is clean."

### 1:30–1:55 — How the live chart works
- **Screen:** the pipeline diagram.
- **Say:** "The chart isn't faked from a backend price — it's driven straight from chain. Every buy and sell emits an event; an indexer streams those, rolls them into OHLC candles, and a WebSocket pushes them live to a TradingView chart. A Chainlink ETH/USD feed converts the on-chain reserves into a live USD market cap — that's what drives the graduation threshold and the UI."

### 1:55–2:05 — Close
- **Say:** "So: contracts that are the market, a real-time pipeline off on-chain events, and a graduation into an AMM. That's Vellos."

---

**Editing tips:** keep pointing at the specific box/curve you're talking about — the visuals carry it. If you want it punchier, cut the fee/creator-economics tangent entirely and stay on curve → graduation → live chart. Drop the Loom URL into `src/data/caseStudies.ts` → `vellos.links[0].href` **and** the `video` gallery block `src`.
