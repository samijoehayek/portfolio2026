# SeedVault (SVLT) — technical talking points

Your prep sheet for speaking about this project as its author — in interviews, on calls, in DMs. Everything here is drawn from the real code (`realworldassets` + `rwa_admin`) and the live Base-mainnet deployment. The tell of authorship is the **"why"** behind each decision — that's what this sheet arms you with.

> Public framing note: on the website the asset is called "agricultural seed reserves." In a private technical conversation you can be specific about the underlying genebank if you want — just keep client PII out of it.

---

## 1. The 20-second pitch
"SeedVault is an ERC-3643 security token on Base that tokenizes ownership of a real-world seed reserve. The interesting part isn't the token — it's that it's **permissioned at the protocol level**: every transfer is checked on-chain against a modular compliance engine and an on-chain KYC identity, so shares can only ever move between verified, allow-listed investors. I built the whole contract suite and the admin dApp, deployed it to Base mainnet, and handed every privileged role to the client trustlessly."

## 2. The mental model (say this to frame everything)
"A normal ERC-20 lets anyone hold and transfer. A security token can't — regulation says only KYC'd, eligible investors can hold it. ERC-3643 (a.k.a. **T-REX**) solves that by making **identity and compliance first-class, on-chain primitives**. The token doesn't decide who can transfer; it **delegates** that to two systems: a **ModularCompliance** engine and an **IdentityRegistry**. Both must say yes or the transfer reverts."

## 3. Architecture — how I built it, and why

**The transfer gate (the heart of it).** On every `transfer`/`mint`/`forcedTransfer`, the token calls:
- `ModularCompliance.canTransfer()` → which runs each bound module. I built a **CountryAllowModule** (ISO country allowlist). It's modular on purpose — new rules (max holders, lockups, etc.) bind without redeploying the token.
- `IdentityRegistry.isVerified(receiver)` → which resolves through the **T-REX triple registry**:
  - **IdentityRegistryStorage** — maps wallet → ONCHAINID + country.
  - **ClaimTopicsRegistry** — what claims are required (topic 1 = KYC).
  - **TrustedIssuersRegistry** — who's allowed to sign those claims.
  - → then reads the receiver's **ONCHAINID** to check it holds a valid KYC claim from a trusted issuer.

**On-chain identity without leaking PII.** Each investor gets an **ONCHAINID** — a digital-passport contract. It doesn't store raw KYC data; it stores **claims** (attestations) signed by a **trusted issuer** (a ClaimIssuer contract). The registry just verifies "does this passport hold a KYC claim from someone we trust?" PII stays off-chain.

**Cheap identity at scale.** Issuing a fresh contract per investor is expensive, so the **ONCHAINIDFactory** deploys identities as **EIP-1167 minimal-proxy clones** with **CREATE2** (deterministic addresses). Clones are ~cheap and the address is predictable before deploy.

**Add-ons I bolted onto the token:**
- **NAVStore** — net asset value per token, 8 decimals, updated by an `ORACLE_ROLE`. NAV is readable straight from chain, no off-chain trust.
- **DocumentsRegistry** — append-only references to IPFS documents (prospectus, audits). Append-only = tamper-evident provenance.

**Supply policy — V2 "burn-disabled" (a deliberate design call).** The client's requirement: shares, once issued, must always exist on-chain (immutable audit trail). So V2 **removes burn** — `burn()` reverts. Redemptions and enforcement go through a **treasury forced-transfer pattern** instead: `forcedTransfer(holder → treasury)`, settle off-chain, tokens sit in a verified treasury wallet. **Effective circulating supply = `totalSupply()` − treasury balance.**

**Tooling:** Solidity 0.8.17/0.8.28, built on the T-REX + ONCHAINID base contracts + OpenZeppelin (upgradeable), **Hardhat 3** with **Ignition** for deterministic, resumable deployments.

## 4. The hard calls / trade-offs (this is where authorship shows)

- **ERC-3643 over a hand-rolled allowlist.** A `mapping(address => bool)` allowlist is trivial but gives you no portable identity, no trusted-issuer claim model, no modular compliance, and it's not a recognized security-token standard. T-REX gives all of that — at the cost of a lot more moving parts (12+ contracts), which is why the deployment order matters so much.
- **Burn-disabled + treasury pattern.** Trade-off: `totalSupply()` never decreases, so you can't do an on-chain capital reduction — the treasury wallet becomes critical infrastructure (should be a multisig). I chose it because an immutable share record is worth more to an auditor than the ability to burn.
- **Two role models, on purpose.** Token + IdentityRegistry use **Ownable + Agent** (that's the T-REX convention — `owner()` / `isAgent()`); NAVStore, DocumentsRegistry, Factory use **OpenZeppelin AccessControl** (`ORACLE_ROLE`, `DOCS_ADMIN_ROLE`, `FACTORY_OPERATOR_ROLE`). Seven roles total. I kept the T-REX contracts idiomatic rather than forcing one model everywhere.
- **Trustless handover.** Owned contracts use **Ownable2Step** (transfer → client *accepts* — a fat-fingered address can't brick the system because it never gains power until accept). AccessControl isn't two-step, so there the order is **grant client `DEFAULT_ADMIN_ROLE` first, then renounce the deployer's** — never renounce first or you lock yourself out. End state: the deployer key has **zero** privilege.

## 5. Gotchas only the person who built it knows
- **T-REX `burn()` isn't `virtual`.** The base `Token.sol` doesn't mark `burn()` virtual, so you can't override it. I added a `patch-package` patch to add the `virtual` keyword, then overrode `burn()` to `revert()` (marked `pure`, ~200 gas to fail). Applied automatically on `npm install`.
- **`compliance.bindToken()` is easy to forget — and if you do, every transfer reverts.** It's a distinct step from `addModule`. This is the #1 thing that silently breaks a deploy.
- **Two `SVTIdentity` deployments that look like a duplicate but aren't.** One is the token's *own* ONCHAINID; the other is the *implementation template* the factory clones (`isLibrary = true`). Miss the distinction and the factory clones point at the wrong thing.
- **The factory needs to be a registry agent.** `identityRegistry.addAgent(factory)` — otherwise `createIdentityAndRegister` can't call back into the registry.
- **SVT → SVLT and V1 → V2.** Testnet had a V1 (burn-enabled) and V2 side-by-side (the SOW evolved mid-test); **mainnet is V2-only, clean.** The on-chain symbol is **SVLT** (some older docs still say SVT).

## 6. The admin dApp (in case they ask about the frontend)
Next.js 16 App Router (every page a client component), **Wagmi 3 + Viem 2**, RainbowKit for wallet connect, TanStack Query (15s refetch). 12 pages — one per subsystem (onchainid, identity, claim-topics, trusted-issuers, compliance, nav, mint-burn, documents…). Reads are **batched** with `useReadContracts`; writes go through a `useContractWriteWithToast` hook that wraps `useWriteContract` + `useWaitForTransactionReceipt` with a pending → submitted → confirmed → error toast lifecycle. A `useRoles()` hook checks all 7 roles + holder status in one batched read; `useChainGuard` nudges the user onto Base.

## 7. Likely questions → crisp answers
- **"How do you stop an unverified wallet from receiving the token?"** → The token calls `IdentityRegistry.isVerified(receiver)` on every transfer; if the receiver has no valid KYC claim from a trusted issuer, or their country isn't allow-listed, `canTransfer` fails and the transfer reverts. It's enforced in the contract, not a backend.
- **"Where does KYC live? Isn't that PII on-chain?"** → No raw PII. The investor's ONCHAINID holds *claims* — signed attestations from a trusted issuer. The chain verifies the claim exists and is validly signed; the personal data stays with the issuer off-chain.
- **"How do you redeem if you can't burn?"** → Treasury pattern: `forcedTransfer` the tokens to a verified treasury wallet, settle off-chain. Circulating supply = total − treasury.
- **"How did you make sure the client — not you — ends up in control?"** → Ownable2Step transfer + client acceptance on the 6 owned contracts, grant-then-renounce on the 3 AccessControl contracts. After handover the deployer key is inert; I rotate it out.
- **"Why Base?"** → Cheap L2 gas (the whole mainnet deploy was ~0.05–0.10 ETH), EVM-equivalent so the full T-REX/OZ stack just works, and BaseScan verification for transparency.
- **"What was the trickiest part?"** → Honest answer: the deployment *order* and the ownership handover. 12+ interdependent contracts that must be wired in exact sequence (bind storage, bind module, bind token, set add-ons, unpause), then handed over without a single moment where a wrong address could brick it. Ignition's resumable deployments + Ownable2Step are what make it safe.

## 8. Vocabulary to stay fluent
ERC-3643 · T-REX · ONCHAINID · claim topic · trusted issuer · ModularCompliance · `canTransfer` · IdentityRegistry · `isVerified` · triple registry · `forcedTransfer` · freeze/pause · NAV oracle · EIP-1167 minimal proxy · CREATE2 · Ownable2Step · AccessControl · Hardhat Ignition · patch-package.

---
*Keep this private — it's your prep, not website copy.*
