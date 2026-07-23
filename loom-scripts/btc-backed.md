# Loom script — BTC Backed product walkthrough

**Target length:** ~1:30–2:00 · **Goal:** show the non-custodial Bitcoin-backed lending flow (borrow → escrow → repay) without exposing real user funds.

> ⚠️ Scaffolded from the product architecture + the marketing site (`btcbacked.com`). I haven't seen the live app's exact screens — **adjust the screen cues to match your real UI** as you record.

**Before you record**
- Use a **demo / test account** on `app.btcbacked.com` (ideally testnet BTC or a sandbox).
- **Scrub/blur** any real balances, wallet addresses, or customer data. **Never show** seed phrases or private keys.
- Have one loan ready to walk through end to end (or pre-stage it so you're not waiting on confirmations).

---

### 0:00–0:15 — Hook
- **Screen:** marketing hero (`btcbacked.com`) → cut into the app dashboard.
- **Say:** "BTC Backed is a Swiss-regulated, non-custodial marketplace for Bitcoin-backed loans. Borrowers unlock liquidity without selling their BTC — and neither side ever gives up their keys."

### 0:15–0:35 — The marketplace
- **Screen:** the offers / requests board.
- **Say:** "It's peer-to-peer. Borrowers post requests, lenders post offers, and they match here on their own terms — rate, size, duration."

### 0:35–0:58 — The escrow (the core idea)
- **Screen:** loan creation → collateral / escrow funding step.
- **Say:** "When a loan matches, the Bitcoin collateral goes into a 2-of-3 multi-signature escrow built on PSBTs. Borrower, lender, and protocol each hold one key — so no single party, including the platform, can ever move the funds alone."

### 0:58–1:18 — Live risk monitoring
- **Screen:** the loan dashboard — LTV / health indicator.
- **Say:** "Each loan's loan-to-value is tracked in real time against a price feed. If it crosses the liquidation threshold, a price-triggered liquidation unwinds the position automatically — by protocol rule, not a manual desk."

### 1:18–1:35 — Repay + release
- **Screen:** repayment flow → collateral released back.
- **Say:** "On repayment, the multisig releases the BTC straight back to the borrower. Non-custodial from the first block to the last."

### 1:35–1:45 — Close
- **Screen:** back to a clean dashboard or the marketing "zero custody" line.
- **Say:** "Swiss-based, regulated, zero custody. That's BTC Backed."

---

**Editing tips:** a focused 90-second take beats a full feature tour; lead with the escrow idea since that's the differentiator. Drop the final Loom share URL into `src/data/caseStudies.ts` → `btc-backed.links[1].href` **and** the `video` gallery block `src`.
