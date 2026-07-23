# Loom script — SeedVault (SVLT) admin-dashboard walkthrough

**Target length:** ~2:00 · **Goal:** convince a technical stranger this is a real, compliant, on-chain security token by walking the full lifecycle (identity → KYC → NAV → mint) in the admin dashboard.

**Before you record**
- Run the `rwa_admin` dashboard; connect the **agent** wallet.
- Do the *writes* on **Base Sepolia** (free gas, disposable state); you can flip to **Base mainnet read-only** for the "it's really live" beat at the end.
- Have a throwaway **test investor wallet address** ready.
- **Never show:** real investor PII, private keys, or seed phrases. Use test data only.

---

### 0:00–0:12 — Hook
- **Screen:** dashboard landing / overview page.
- **Say:** "This is SeedVault — an ERC-3643 security token on Base that represents fractional ownership of a real-world seed reserve. Unlike a normal ERC-20, *every* transfer is permissioned and checked on-chain. Here's how it's run."

### 0:12–0:35 — On-chain identity
- **Screen:** `/onchainid` → `createIdentity` for the test investor wallet.
- **Say:** "First an investor needs an on-chain identity. This deploys an ONCHAINID contract — a digital passport — as a minimal-proxy clone, so it's cheap to issue. This is where their KYC claims will live."

### 0:35–0:58 — Register + KYC claim
- **Screen:** `/identity` → `registerIdentity` (country e.g. `840`). Flash `/trusted-issuers` and `/claim-topics`.
- **Say:** "We register that identity with the token's IdentityRegistry and tag their country. A trusted issuer signs a KYC claim onto their passport for the required topic. Now `isVerified()` returns true for this wallet."

### 0:58–1:16 — Compliance rules
- **Screen:** `/compliance` → show the allowed-countries list.
- **Say:** "The token delegates every transfer to a modular compliance engine. This is the country-allowlist module — only these jurisdictions can hold the token, and new rules plug in without redeploying the token."

### 1:16–1:34 — NAV oracle
- **Screen:** `/nav` → `updateNav`, watch it persist.
- **Say:** "Net asset value per token is published on-chain by an oracle role, to 8 decimals. Anyone can read the live NAV straight from the contract — no off-chain trust."

### 1:34–1:55 — Mint (the payoff)
- **Screen:** `/mint-burn` → `mint` 1 SVLT to the verified investor; show the toast → tx hash. *(Optional: attempt a mint to an unverified wallet and show it revert.)*
- **Say:** "Now we mint. Because the recipient is verified and allow-listed, it goes through — send to an unverified wallet and the contract reverts. And there's no burn: supply is immutable by design, so redemptions run through a treasury transfer instead of destroying shares."

### 1:55–2:05 — Close on proof
- **Screen:** `/documents` (`addDocument` with an IPFS CID), then cut to the **BaseScan verified contract** page.
- **Say:** "Documents are anchored to IPFS, append-only. And all of this is live and source-verified on Base mainnet. That's SeedVault."

---

**Editing tips:** record at 1440p; trim dead air between tx confirmations; a tight 2-minute take beats a 5-minute tour. Drop the final Loom share URL into `src/data/caseStudies.ts` → `seedvault.links[1].href` **and** the `video` gallery block `src`.
