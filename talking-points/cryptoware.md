# Cryptoware — technical talking points

Your prep sheet for speaking about the Cryptoware agency era (NFT / launchpad / marketplace / DeFi / DAO) as its author.

> **How to use this.** This is grounded in your résumé (what you shipped: ERC-721/721A/1155 launches, $4M+/5,000+ holders, an 80-launch launchpad, the OASISX marketplace) **plus deep research into how each piece is built at best-practice level**. The code lives in private client repos I don't have, so the specific mechanics below are the *standard, correct* way these are built — speak to the ones you genuinely touched, and treat anything unfamiliar as "and the modern way to do that is…". The three **wow** beats (ERC-721A gas trick, VRF-fair reveal, escrow-less signed-order marketplace) are the ones to lead with — most engineers can't explain them.

---

## 1. The 20-second pitch
"Cryptoware was my Web3 agency era — two years shipping NFT drops, a launchpad, a marketplace, and DeFi/DAO tooling, contracts plus React front-ends. The numbers: **$4M+ in NFT sales across 5,000+ holders**, and a launchpad that shipped **80 token launches**. The interesting engineering is in three places — gas-lean mints, provably-fair reveals, and an escrow-less signed-order marketplace."

## 2. NFT standards — and the ERC-721A gas trick (wow #1)
- **ERC-721 vs 721A vs 1155:** plain **721** for transfer-heavy 1-of-1s and max tooling compatibility; **721A** for big public PFP drops where people mint several at once; **1155** for editions / game items / mixed fungible+NFT (one contract, native batch transfers).
- **The ERC-721A trick (know this cold):** vanilla ERC-721 does one `SSTORE` of the owner **per token** minted. ERC-721A (Chiru Labs / Azuki) writes the owner **once for the first token in a batch** and resolves `ownerOf()` by **scanning backwards** to the nearest explicitly-set owner. Minting 5 goes from ~617k gas to ~85k — **~86% less**. **The honest trade-off:** the first transfer of a lazily-owned token has to *materialize* its owner slot, so transfers cost more (~90–99k gas). Net: 721A wins when buyers mint many and hold; less so for high-velocity flipping. *(Saying this trade-off out loud is what signals you actually understand it.)*

## 3. Allowlists — Merkle vs EIP-712 (wow #2, a real engineering choice)
- **Merkle-tree allowlist:** hash the allowed addresses into a tree, put the **32-byte root** on-chain (one `SSTORE`), and the minter submits a **Merkle proof** the contract verifies. **Constant** on-chain cost whether the list is 10 or 10,000 (vs a `mapping` that pays an `SSTORE` per address). Trustless, no backend at mint time, but the list is committed/immutable (update = new root).
- **EIP-712 signature allowlist:** a backend signs a typed-data voucher `(minter, maxQty, nonce)`; the contract `ecrecover`s it (~3k gas) and checks the signer. **Zero on-chain setup, cheapest mint, fully dynamic** — but it reintroduces a **hot signing key** and a live backend, and needs a **nonce** to stop replay.
- **One-liner:** *"Merkle for a fixed, trustless, committed list; signatures for a dynamic, gasless, backend-driven one — trading a hot key for flexibility."*
- Around it: phased mint (`Closed → Allowlist → Public`), per-wallet + supply caps, `nonReentrant`, checks-effects-interactions, and withdraw via `call` to a treasury/`PaymentSplitter`.

## 4. Provably-fair reveal — provenance + Chainlink VRF (wow #3)
The problem: if the team can see which token ID maps to which rare before reveal, they can snipe. The fix is **commit-then-reveal**:
1. **Provenance hash** — before the sale, hash the artwork in a fixed order and store `PROVENANCE_HASH` on-chain. This cryptographically commits to the images *and their order*.
2. **Randomized starting index** — `assignedImage = (tokenId + startingIndex) mod SUPPLY`, where `startingIndex` is set **once, after mint closes**.
3. **Chainlink VRF** provides that random value **with an on-chain-verified proof**, so it's tamper-proof. *Why not `blockhash`?* Validators can influence it — a known footgun. Metadata is pinned to **IPFS** (content-addressed, so it can't be silently swapped).

## 5. Royalties — the 2022–23 wars (a story you lived)
- **EIP-2981** standardized `royaltyInfo(tokenId, salePrice)` — but it only *signals*; it doesn't enforce.
- **OpenSea's Operator Filter Registry** (2022–23) tried to *enforce* by blocklisting zero-royalty marketplace contracts from `transferFrom` — a transfer-blocking hack that broke composability and got sunset/made optional.
- **ERC-721C** (Limit Break) moved enforcement **into the token** via a **transfer validator** the token consults on every transfer, enabling **programmable, creator-enforced royalties**; OpenSea later integrated it. Net: royalties are contractually enforceable for creators who opt into a 721C validator, best-effort otherwise.

## 6. The launchpad — a clone factory
Shipping 80 collections means you can't redeploy full bytecode each time (~2–3M gas). The pattern: a **factory that deploys EIP-1167 minimal-proxy clones** of one pre-deployed implementation.
- A minimal proxy is a **~45-byte** contract that `DELEGATECALL`s everything to the implementation → a launch costs a fraction of a full deploy.
- `LaunchpadFactory.create(...)` → `Clones.clone(impl)` (or `cloneDeterministic(impl, salt)` with **CREATE2** to *predict the address before deploy*) → then the clone's **`initialize(supply, price, phases, merkleRoot, royaltyBps, …)`**.
- **Why `initialize` not a constructor:** clones share the impl's bytecode but have **their own storage**; a constructor would run in the impl's context. So templates use **no constructor** + OpenZeppelin **`Initializable`** (`initializer` runs once). One factory, three implementation templates (721A / 1155 / 20).

## 7. OASISX — an escrow-less signed-order marketplace
The modern marketplace (Seaport / 0x lineage) is **approvals-based with off-chain orders**:
1. **Approvals, not escrow** — the seller keeps the NFT and grants the settlement contract an approval; nothing is locked.
2. **Off-chain EIP-712 order** — the seller signs `(offer, consideration, fees, royalty, nonce, expiry)` with their wallet. **No gas, no tx to list.**
3. **On-chain settlement** — a buyer fulfils; the contract **verifies the signature (~3k gas)**, checks nonce/expiry/cancellation, and **atomically** moves the NFT and splits payment: seller / platform fee / **EIP-2981 royalty** — all-or-nothing.
4. **Safety** — EIP-712's domain separator (chainId + verifying contract) blocks cross-chain/contract replay; the real risk to flag is **blind-signature phishing** (users signing malicious orders offline), so you scope approvals and surface human-readable order data.
- Lineage soundbite: *"Wyvern matched two orders and was heavy; Seaport is a lighter fulfilment model (~35% more gas-efficient); 0x is the canonical off-chain-relay / on-chain-settle design."*

## 8. The DeFi / DAO around it
- **Staking/farming — the O(1) accumulator** (worth knowing cold): you pay N stakers proportional to stake×time **without looping**. A global `rewardPerTokenStored` accumulates "reward one staked token has earned since inception"; each user stores a **snapshot** (`userRewardPerTokenPaid`) at their last interaction, so `earned = balance * (rewardPerToken − userPaid) / 1e18 + rewards` is a subtraction and a multiply — O(1). Synthetix `StakingRewards` snapshots the accumulator; MasterChef stores the equivalent `rewardDebt`. *Most engineers can't explain why this doesn't need a loop — you can.*
- **Swaps/AMM & arbitrage:** constant-product `x·y=k` router integration with slippage + deadline; arbitrage is atomic cross-venue price capture, often flash-loan-funded, profitable only past gas + fees + price impact.
- **DAO:** OpenZeppelin **Governor + TimelockController + `ERC20Votes`**. Voting power is **checkpointed and delegated**, and the Governor reads `getPastVotes` at the proposal snapshot — which **blocks flash-loan vote-buying**. Lifecycle: **Propose → Vote → Queue (timelock) → Execute**, with the Timelock (not the Governor) holding the treasury.

## 9. Likely questions → crisp answers
- **"How did you make big mints cheap?"** → ERC-721A: owner written once per batch, resolved by back-scan on read — ~86% less mint gas, with pricier transfers as the trade-off.
- **"How did presale allowlists work?"** → Merkle root on-chain + proof at mint for a fixed list; EIP-712 signed vouchers for a dynamic one. I'd pick based on whether the list needed to change and whether we wanted a backend in the loop.
- **"How do you stop the team sniping rares?"** → Provenance-hash commitment + a Chainlink VRF starting-index set after mint — VRF because block-hash randomness is validator-influenceable.
- **"How does the marketplace move an NFT without holding it?"** → Escrow-less: the seller signs an EIP-712 order off-chain and keeps the NFT behind an approval; the settlement contract verifies the sig and atomically transfers + splits payment on fulfilment.
- **"Royalties — enforceable?"** → EIP-2981 signals; real enforcement came with ERC-721C's transfer validator. I worked across that whole shift.
- **"How does staking pay everyone without a loop?"** → A global reward-per-token accumulator + a per-user snapshot; owed rewards are an O(1) subtraction, no iteration over holders.

## 10. Vocabulary to stay fluent
ERC-721 / 721A / 1155 · lazy ownership / back-scan · Merkle root + proof · EIP-712 signature voucher · `ecrecover` · provenance hash · randomized starting index · Chainlink VRF · EIP-2981 · Operator Filter · ERC-721C transfer validator · EIP-1167 minimal proxy · `Clones.cloneDeterministic` · CREATE2 · `Initializable` · escrow-less / approvals · signed-order settlement · Seaport / 0x · `rewardPerTokenStored` accumulator · MasterChef `rewardDebt` · OZ Governor / Timelock / `ERC20Votes`.

---
*Keep this private — it's your prep, not website copy.*
