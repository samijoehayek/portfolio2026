# Loom script — Cryptoware (agency-era) engineering walkthrough

**Target length:** ~2:00 · **Goal:** the code lives in many private client repos and there's no single live site, so this is a **narrated architecture walkthrough** — screen-share the case-study page (impact numbers → launch-engine diagram → marketplace diagram) and tell the story of two years shipping NFT / launchpad / marketplace products.

**Before you record**
- Open the Cryptoware case-study page (or the three artifacts: the impact block, the launch-engine diagram, the OASISX diagram).
- Nothing confidential to leak — you're explaining patterns and standards, not client code.

---

### 0:00–0:15 — Hook (lead with impact)
- **Screen:** the "By the numbers" block.
- **Say:** "This was my agency era at Cryptoware — two years shipping Web3 products end to end. The headline: NFT collections doing over $4M in sales across 5,000+ holders, plus a launchpad that shipped 80 token launches. Let me show you the engineering behind that."

### 0:15–0:45 — The NFT launch engine + the ERC-721A trick
- **Screen:** the launch-engine diagram, point at Factory → Collection.
- **Say:** "The launchpad is a factory that clones a fresh collection per launch — EIP-1167 minimal proxies, so a new collection is ~45 bytes of bytecode instead of a full redeploy. Each clone is an ERC-721A collection, and here's the gas trick that matters: ERC-721A writes the owner **once per batch** instead of once per token, and resolves ownership by scanning back on read. On a big public mint that's roughly **86% less gas** — the honest trade-off being slightly pricier transfers, so it's a win when buyers mint several and hold."

### 0:45–1:10 — Gating the mint (allowlists + phases)
- **Screen:** the ① Phased Mint box.
- **Say:** "Presales are gated two ways depending on the drop. A **Merkle allowlist** puts a single 32-byte root on-chain and the minter submits a proof — trustless, constant cost whether the list is 10 or 10,000 addresses. Or an **EIP-712 signature** where a backend signs a voucher and the contract recovers it — cheapest mint and fully dynamic, at the cost of a hot key. Then it's phased: closed → allowlist → public, with per-wallet and supply caps."

### 1:10–1:30 — The fair reveal (the trust part)
- **Screen:** the ② Fair Reveal box.
- **Say:** "The trust-critical piece is the reveal. Before the sale we commit a **provenance hash** of the artwork in a fixed order. Then a **Chainlink VRF** random value sets a starting-index offset that maps token IDs to images — so nobody, us included, can snipe rares. We use VRF specifically because block-hash randomness can be nudged by validators. Metadata's pinned to IPFS."

### 1:30–1:55 — The marketplace (OASISX)
- **Screen:** the OASISX diagram.
- **Say:** "On the marketplace side — OASISX, a MENA P2P marketplace — it's escrow-less. A seller signs an **EIP-712 order off-chain, no gas**, keeping the NFT in their own wallet behind an approval. When a buyer fulfils it, the settlement contract verifies the signature — about 3,000 gas — checks it's not cancelled or expired, and in one atomic transaction moves the NFT and splits payment across seller, platform fee, and the EIP-2981 royalty. Same lineage as Seaport and 0x."

### 1:55–2:05 — Close
- **Say:** "Clone-factory launchpad, gas-lean fair mints, an escrow-less signed-order marketplace — plus the DeFi and DAO pieces around them. That was Cryptoware."

---

**Editing tips:** keep pointing at the specific box you're describing. If you want it tighter, cut the allowlist detail and keep the three wow beats: ERC-721A gas trick → VRF reveal → escrow-less marketplace. Drop the Loom URL into `src/data/caseStudies.ts` → `cryptoware.links[0].href` **and** the `video` gallery block `src`.
