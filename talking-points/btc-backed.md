# BTC Backed — technical talking points

Your prep sheet for speaking about BTC Backed as its author. Grounded in the real code (`btcbacked-backend` NestJS API, `btcbacked-webapp-v2` React SPA, `multisig-poc`). The tell of authorship is the **"why"** — that's what this arms you with.

---

## 1. The 20-second pitch
"BTC Backed is a Swiss-regulated, non-custodial peer-to-peer marketplace for Bitcoin-backed loans. Borrowers unlock liquidity without selling their BTC; lenders earn yield secured by over-collateralized Bitcoin. The core is a **2-of-3 multisig escrow** — the platform can never move anyone's collateral on its own. I built the backend Bitcoin layer (multisig, PSBTs, liquidation), the loan lifecycle, and the compliance stack."

## 2. The mental model
"It's a trust-minimized escrow. The borrower's BTC goes into a 2-of-3 multisig whose three keys are **borrower, lender, and platform**. Any two can spend — so the happy path (repay → release to borrower) and the default path (liquidate → to lender) each work with the platform plus one counterparty, but the platform *alone* can never touch the funds. Non-custodial by construction."

## 3. Architecture — how I built it, and why

**The escrow (the heart).** A **2-of-3 P2WSH multisig** — `bitcoin.payments.p2ms({ m: 2, pubkeys })` wrapped in `p2wsh` (native segwit). Three keys: borrower, lender, platform. Keys are **sorted (BIP67, `Buffer.compare`)** so all three parties independently derive the *identical* escrow address. Keys come from **BIP32 HD derivation** (`@scure/bip32` / `bip39`), and I build **output descriptors** (`@bitcoinerlab/descriptors`) so Bitcoin Core can import and watch the address.

**Signing without custody — PSBTs + BBQr.** Every spend is a **PSBT** (Partially Signed Bitcoin Transaction). For air-gapped / hardware-wallet users, PSBTs move as **animated QR via BBQr**, and I pad them to a byte threshold (~2700) so the frame count stays stable across signing rounds. Keys never leave the user's device.

**Liquidation — the sophisticated part.** The `contract-health` module tracks **LTV** in real time against a price feed. At **LTV 0.8** the system prepares a Bitcoin **package relay (CPFP)** so the liquidation transaction can be fee-bumped and actually confirm under mempool congestion — you don't want a liquidation stuck in the mempool while the price keeps falling. Liquidation moves collateral to the lender (platform + lender co-sign the 2-of-3). Borrowers can also **top up collateral** (`collateral-topup`) to avoid it.

**The loan is a 20-state machine.** `PENDING → ESCROW_SETUP → WAITING_FOR_COLLATERAL → AML_PENDING → IN_PROGRESS → COMPLETED`, with explicit branches for dispute, liquidation, cancellation, and top-up. Every transition is guarded.

**Concurrency safety.** Bitcoin wallet operations are serialized behind an **`async-mutex`** — two jobs must never build conflicting spends of the same UTXOs.

**Stack.** NestJS 11 + Prisma/MySQL 8; **Redis-backed Bull queues** for async jobs (liquidation, AML, notifications, dispute timers, fee-overdue); **Bitcoin Core RPC** for wallets/tx (separate escrow + fee wallets); Socket.IO for real-time; KSUID/Nanoid IDs; a `BigIntSerializationInterceptor` because sats are `BigInt`.

**Compliance (Swiss VQF).** Money never moves before a stack of auth guards passes: `JwtAuthGuard → SuspendedUserGuard → TotpGuard → RolesGuard → VerificationLevelGuard`. Integrations: **Sumsub** (KYC/KYB), **AMLBot** (address/tx AML), **CryptoSwift** (FATF Travel Rule), `btc-address` risk scoring, **Badger** blockchain data gateway — each with a mock mode for dev.

**Frontend (`webapp-v2`).** React 19 SPA, **TanStack Router/Query/Form + Zod**, a strict **three-layer architecture** (`Routes → Features → Parity` pure logic) with a **View Model per screen**, i18next, Socket.IO, QR scanning (`zbar-wasm`) for PSBT signing, and the Sumsub web SDK. Non-custodial signing happens client-side.

## 4. The hard calls / trade-offs (authorship shows here)
- **2-of-3, not 2-of-2 or custodial.** 2-of-3 gives non-custodial *and* dispute resolution: both the happy and default paths need only two signatures, and the platform can never move funds alone. 2-of-2 borrower/lender would deadlock on a dispute; custodial defeats the entire premise.
- **P2WSH (native segwit) over P2SH.** Lower fees, cleaner witness, modern standard. Cost: a bit more address-type handling in code.
- **BBQr animated QR + padding.** Air-gapped signing is the security gold standard, but multi-frame QR is fiddly — padding to a fixed byte threshold keeps the frame count stable so the signing UX doesn't jump between rounds.
- **Package relay / CPFP for liquidations.** The naive path broadcasts a liquidation and hopes. Under a fee spike it can get stuck — catastrophic when you're racing a falling price. Preparing a CPFP package at LTV 0.8 lets the liquidation be fee-bumped to confirm. Real Bitcoin mempool engineering, not just app logic.
- **Explicit 20-state machine over ad-hoc booleans.** A loan genuinely has many states (dispute, liquidation, top-up, cancellation); modeling them explicitly makes transitions auditable and branches testable.

## 5. Gotchas only the person who built it knows
- **Sort the pubkeys (BIP67) or you get a different address.** `p2ms` is order-sensitive; sorting with `Buffer.compare` makes all three parties derive the same escrow address independently.
- **Sats are `BigInt`** — JSON can't serialize it, so a global interceptor handles every amount; forget it and every money field in a response throws.
- **Node 20.19.0 *exactly*** — a `preinstall` hook enforces it; a mismatch causes lockfile drift that breaks `npm ci` on deploy.
- **Custom fee estimation for P2WSH multisig** — standard estimators assume single-sig; the redeemScript (105 bytes for 3 keys) and witness sizes are computed by hand so multisig fee math is right.
- **BBQr padding must survive the signing round-trip** so the animated-QR frame count stays consistent.

## 6. Likely questions → crisp answers
- **"Is it really non-custodial?"** → Yes. Collateral is a 2-of-3 where borrower and lender each hold a key; the platform holds the third but can't sign alone. Every spend is a PSBT the user co-signs on their own device.
- **"What happens on a margin call / default?"** → `contract-health` tracks LTV; the borrower can top up collateral; if LTV breaches the threshold, platform + lender co-sign a liquidation to the lender, fee-bumped via package relay so it confirms.
- **"Disputes?"** → 2-of-3 lets the platform co-sign with whichever party is in the right; there's a dispute module with Bull-timed deadlines.
- **"How do users sign without exposing keys?"** → PSBTs + BBQr animated QR for air-gapped/hardware signing; keys never leave the device.
- **"Regulation?"** → Swiss VQF. KYC/KYB (Sumsub), AML (AMLBot), Travel Rule (CryptoSwift), address risk scoring — enforced by stacked guards before any money moves.
- **"Trickiest part?"** → the liquidation path under fee pressure (CPFP/package relay), and deriving a deterministic multisig address across three independent parties.

## 7. Vocabulary to stay fluent
2-of-3 multisig · P2WSH · `p2ms` · PSBT · BBQr · BIP32/39 HD derivation · output descriptors · BIP67 key sorting · Bitcoin Core RPC · CPFP / package relay · LTV · liquidation · Travel Rule · Sumsub / AMLBot / CryptoSwift · VQF · NestJS · Bull/Redis · `async-mutex`.

---
*Keep this private — it's your prep, not website copy. (Note: the backend's own CLAUDE.md says "3-of-3" — the code is `m: 2`, i.e. 2-of-3. Worth fixing that doc.)*
