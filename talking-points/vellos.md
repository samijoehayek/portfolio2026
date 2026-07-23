# Vellos — technical talking points

Your prep sheet for speaking about Vellos as its author.

> **How to use this (read first).** Unlike SeedVault / BTC Backed, the Vellos code is gone, so this isn't reverse-engineered from a repo — it's built from **what you told me you actually did** (a pump.fun-style bonding-curve platform on Ethereum, Solidity contracts, a TradingView chart fed straight from on-chain data, and an oracle + WebSocket backend for live price) **plus deep research into how that's built at best-practice level today**. Speak confidently about the concepts you genuinely worked with (the curve, the on-chain-driven chart, the real-time backend); the sections marked *"how I'd build it today"* are current state-of-the-art you can offer as "and if I rebuilt it now, I'd…". If an interviewer digs into a specific line you don't remember, it's totally fine to say "that was a couple of years ago — here's the shape of it" and lean on the math and architecture, which don't change.

---

## 1. The 20-second pitch
"Vellos was a pump.fun-style fair-launch platform I built on Ethereum. Anyone launches a token and it trades instantly on an **on-chain bonding curve** — price is pure supply and demand, no seeded liquidity, no team allocation. When a token's curve fills, its liquidity **graduates** into an AMM. And the price chart isn't a backend guess — it's a **TradingView chart driven straight from on-chain trade events** through a real-time indexer + WebSocket pipeline."

## 2. The mental model
"The bonding curve *is* the market. There's no order book and no LP to seed — a smart contract holds reserves and quotes a price off a constant-product formula. A buy moves you up the curve, a sell moves you down. Once enough is raised, the token graduates: the liquidity migrates into a real AMM pool and the curve is done."

## 3. The bonding-curve math (the core — know this cold)
- **Invariant:** `k = x · y`, where `x` = the quote (ETH) reserve and `y` = the token reserve — the same constant-product Uniswap uses.
- **Spot price:** `P = x / y`.
- **Virtual reserves (the key trick):** `x` and `y` are seeded *virtually* (larger than the real balances), so the price is a sensible **non-zero value at launch** instead of zero, and the curve has an **asymptote** — it can never be fully drained.
- **Buy Δy tokens:** you pay `dx = x·Δy / (y − Δy)` (preserve `k`: new quote reserve `= k/(y−Δy)`, you pay the difference). Inverse (tokens out for `dx` in): `Δy = y·dx / (x + dx)`.
- **Sell Δy tokens:** you receive `dx = x·Δy / (y + Δy)`.
- **Market cap:** `mcap = x · totalSupply / y`.
- **Why constant-product over linear/exponential:** cheapest, most precise math (mul/div only — no `exp`/`ln` rounding-attack surface), a guaranteed liquidity floor (the asymptote), and — decisively — the curve is *already a Uniswap pool shape*, so **graduation is seamless**.

## 4. How pump.fun works (the reference you're echoing)
- Constant-product curve over **virtual reserves**: launch config ≈ **1.073B virtual token reserve, 30 virtual SOL, 793.1M tokens actually sold on the curve** (press rounds it to "800M"; the other ~206.9M seed the AMM), 1B total supply.
- **Graduation** fires when **real token reserves hit 0** (the curve sells out) — ≈ **$69k market cap**, ≈ **85 SOL** collected. Liquidity then **migrates to an AMM (PumpSwap, formerly Raydium) and the LP is burned** — permanently locked, so there's no migration-stage rug.
- **Fees:** started at a flat **1% (100 bps)** buy & sell; in 2025 pump.fun moved to a **dynamic, market-cap-tiered fee** and **creator fee-sharing**. (Good "I'd tune the fee model" talking point.)

## 5. How I'd build it on Ethereum (Solidity)
- **Factory + minimal-proxy clones (EIP-1167).** One immutable token (and curve) implementation; the factory `Clones.cloneDeterministic(impl, salt)` per coin — **CREATE2**, so you can predict the address before deploy. Clone bytecode is ~55 bytes → up to ~10× cheaper per launch. Clones need a guarded `initialize()` (no constructor).
- **Token:** **Solady ERC20** (~66% cheaper deploy than OpenZeppelin — compounds across thousands of launches), OZ for factory/admin plumbing.
- **Curve contract:** `buy(minTokensOut, deadline) payable` / `sell(tokenAmount, minEthOut, deadline)`; curve math in WAD fixed-point (Solady `FixedPointMathLib` / `fullMulDiv` for 512-bit intermediates); **round in the protocol's favor** (input up on buys, output down on sells) so a trade sequence can never drain reserves.
- **Graduation — two schools:**
  1. **Seed Uniswap v2 + burn the LP** (`0xdead`) — simplest, easiest to audit, provably locked. What the classic clones and four.meme do.
  2. ***How I'd build it today* — a Uniswap v4 custom-curve hook.** With `beforeSwapReturnDelta`, a v4 hook returns a `BeforeSwapDelta` that **replaces** the native x·y=k pricing with your bonding curve — the curve **is** the pool, so there's **no migration window to exploit** (historically the biggest rug surface). This is what **Doppler** (Whetstone — a Dutch-auction curve in a v4 hook, orchestrated by their "Airlock"), **Zora Coins** (`ZoraV4CoinHook`), and **Uniswap's own CCA launchpad** (Nov 2025) do.

## 6. Security (how you talk about not getting rekt)
- **Reentrancy:** CEI (update reserves *before* transfers) + `ReentrancyGuardTransient` (EIP-1153 transient storage — ~200 gas vs ~7,100).
- **MEV / sniping:** slippage bounds + `deadline` are the baseline; add **per-block / per-wallet buy caps**, a decaying **"sniper tax"** over the first N blocks, and route the launch/seed tx through a **private mempool (Flashbots Protect)**. Never let min-out be 0 (that's an unlimited-slippage sandwich invite).
- **Rounding/overflow:** Solidity 0.8 checked math; `mulDiv` (512-bit) for `x·Δy` scaled by 1e18; always round in the protocol's favor.
- **Testing:** Foundry **invariant / stateful-fuzz** tests — the fuzzer calls buy/sell/graduate in random orders trying to break: (a) **solvency** (contract can always pay out), (b) **price monotonicity** (a buy never lowers price), (c) **LP locked after graduation**. Echidna/Medusa as a second engine.

## 7. Backend — the real-time price pipeline (your real anchor)
- **Indexer:** stream the curve's `Trade` (buy/sell) events — **Ponder** (TS indexing framework, realtime + reorg-safe → Postgres) or a **custom viem indexer** (`watchContractEvent` live + `getLogs` backfill). Emit post-trade reserves in the event so consumers derive price without an RPC round-trip. Handle reorgs by rolling back affected blocks and re-deriving candles.
- **OHLC candles:** each trade → `price = newEthReserve / newTokenReserve`. Aggregate into time buckets (1m/5m/1h/1d): **open** = first, **high** = max, **low** = min, **close** = last, **volume** = Σ eth. **TimescaleDB** is built for this — a **hypertable** of raw trades + **continuous aggregates** (`time_bucket()` + `first/max/min/last/sum`, auto-refreshed, incremental). **Redis** holds hot state (latest price, the in-progress candle) + a **pub/sub** channel.
- **WebSocket:** workers subscribe to Redis pub/sub and push both **finalized candles** (appended) and **in-progress candle** updates (mutate the current bar) — that's what makes the chart tick live. Stateless workers scale horizontally off the same channel.
- **Chainlink ETH/USD:** two roles — on-chain, `AggregatorV3Interface.latestRoundData()` (8-decimal USD, validate `updatedAt` freshness) turns ETH reserves into a **USD market cap** for display; off-chain, the indexer reads the same feed for USD candles. **Design note:** define the graduation *trigger* in **native ETH** (deterministic, oracle-manipulation-proof) and use Chainlink only for the **displayed** USD mcap.

## 8. Frontend — the chart (your real anchor)
- **TradingView Lightweight Charts** (Apache-2.0, ~35 KB): `series.setData(history)` for the initial load, then **`series.update(bar)` on every WebSocket tick** — same timestamp mutates the forming candle, a later timestamp appends a new one. Upgrade to **Advanced Charts** (implement the **Datafeed API** — `getBars` + `subscribeBars`) if you need indicators/drawings/saved layouts.
- **Trade stack:** **wagmi v2 + viem + RainbowKit** (+ TanStack Query). Pattern: `useSimulateContract` (pre-flight) → `useWriteContract` → `useWaitForTransactionReceipt`, with toasts off `isPending → confirming → confirmed`. Slippage as bps (`minOut = expectedOut · (10_000 − bps) / 10_000`) + a 5-min `deadline`.

## 9. Likely questions → crisp answers
- **"How does the price actually move?"** → Constant-product over virtual reserves: `price = x/y`. A buy removes tokens (y↓) so price rises; a sell adds them so it falls. Buying Δ costs `x·Δ/(y−Δ)`.
- **"Why virtual reserves?"** → So price is non-zero at launch and the curve can't be drained — and because it's the exact Uniswap invariant, graduation into a pool is seamless.
- **"What's graduation?"** → At a fixed ETH threshold the curve sells out; the accumulated liquidity seeds an AMM pool and the LP is locked/burned so trading continues with no rug.
- **"Isn't the chart just your backend making up a price?"** → No — it's driven off on-chain trade events: indexer → OHLC candles → WebSocket → TradingView. The number on the chart is the number in the contract.
- **"How do you stop snipers / sandwiches?"** → Slippage + deadline, per-block buy caps, a decaying sniper tax at launch, and a private mempool for the seed tx.
- **"How would you build it today vs then?"** → Then: a standalone curve contract that seeds a v2 pool and burns LP. Today: run the whole curve **inside a Uniswap v4 hook** (Doppler/Zora pattern) so there's no migration window at all.

## 10. Vocabulary to stay fluent
bonding curve · constant product `x·y=k` · virtual reserves · `price = x/y` · `dx = x·Δy/(y∓Δy)` · graduation · LP burn/lock · EIP-1167 clones · CREATE2 · Solady · Uniswap **v4 hooks** · `beforeSwapReturnDelta` · Doppler / Zora Coins / CCA · `ReentrancyGuardTransient` · sniper tax · Flashbots Protect · Ponder · TimescaleDB continuous aggregates · OHLC · WebSocket · Chainlink `AggregatorV3Interface` · TradingView Lightweight Charts · wagmi/viem/RainbowKit.

---
*Keep this private — it's your prep, not website copy.*
