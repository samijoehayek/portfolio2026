# STC — technical talking points

Your prep sheet for speaking about the STC national tourism metaverse as its author.

> **How to use this.** Grounded in your résumé (you led a Ministry-of-Tourism metaverse full-stack: R3F/Three.js 3D, multi-chain Solidity, Ts.ED backend, Docker/Nginx) **plus deep research into how each piece is built at best-practice level**. It's under NDA and I don't have the code, so the mechanics below are the *standard, correct* way — speak to what you genuinely built and treat anything unfamiliar as "and the modern way to do that is…". **Four honesty guardrails** (they make you *more* credible): (1) *multi-chain ≠ shared state* — be precise; (2) *bridges are the most-exploited component* — frame interop as bounded/rate-limited, never "frictionless omnichain"; (3) *a WebGL canvas is inaccessible* — a government product needs non-3D fallbacks (WCAG 2.2); (4) if you used **Ready Player Me** or **Hathora**, they shut down in early 2026 — say it in past tense and name the open alternatives (VRM, Edgegap). The three **wow** beats to lead with: 3D perf (instancing + Draco/KTX2), ERC-4337 gasless onboarding, and the soulbound multi-chain passport.

---

## 1. The 20-second pitch
"I led a national tourism metaverse for the Saudi Ministry of Tourism — a real-time, multi-user 3D world in a browser tab with an on-chain identity layer. Full-stack: the R3F/Three.js 3D client, a multi-chain Solidity layer, a Ts.ED backend and the DevOps. The whole thing is shaped by one constraint — **the users are tourists, not crypto natives** — which is why the most interesting engineering is in 3D performance, gasless onboarding, and a soulbound multi-chain passport."

## 2. 3D in the browser — the perf story (wow #1)
- **Why it's hard:** browser 3D is **CPU-bound on draw calls, not GPU-bound on triangles**. Every draw call carries JS + driver overhead; aim **under ~100/frame**, it degrades badly **above ~500**. Measure with `renderer.info.render.calls`.
- **Instancing is the biggest lever:** `InstancedMesh` renders thousands of copies of one geometry+material in a **single draw call** (drei `<Instances>`). 1,000 trees = 1,000 draw calls as separate meshes, or **1** instanced. Real wins cited: 9,000 → 300 draw calls; 15fps → 60fps. *Honest caveat:* native InstancedMesh has **no per-instance frustum culling or LOD** (the fix is `InstancedMesh2`); `BatchedMesh` handles *different* geometries sharing a material.
- **LOD + culling:** `THREE.LOD` swaps detail by distance (with hysteresis to stop flicker); frustum culling is automatic, **occlusion culling is not** (do it via three-mesh-bvh).
- **The compression pair (the one-liner):** **"Draco shrinks the download, KTX2 shrinks the GPU memory — you need both."** Draco compresses *geometry* ~90% but is a **download optimization only** (decodes to full size in VRAM, decoder runs in a Web Worker). **KTX2/Basis** keeps textures GPU-compressed *into VRAM* — a 2K RGBA texture is **16MB in VRAM regardless of its file size**, and KTX2 cuts that **4–8×**. glTF/GLB is the runtime format; **FBX is authoring-only, converted offline**. Tooling: `gltf-transform` / `gltfpack`.
- **WebGPU (2024–26):** Three.js `WebGPURenderer` + **TSL** (write shaders once → GLSL for WebGL2, WGSL for WebGPU) with automatic fallback; by late 2025 all major browsers ship WebGPU (~95%). Buys compute shaders + lower per-draw CPU cost (2–10× in heavy scenes).
- **Discipline:** Three.js doesn't GC GPU memory — you `dispose()` geometries/materials/textures explicitly and handle WebGL context loss; cap DPR to `min(dpr, 2)` on mobile (DPR 3 = 9× the fill rate). *(Rive was the 2D/UI layer — vector HUD/menus over the WebGL canvas, off the 3D hot path.)*

## 3. Real-time multiplayer
- **Authoritative server:** the server is the source of truth; **clients send inputs (intentions), not results** — the core anti-cheat.
- **Three techniques that make it feel instant:** **client-side prediction** (simulate your own input immediately, no round-trip lag), **server reconciliation** (sequence inputs, snap to server state and replay the un-acked ones), **entity interpolation** (render *other* players ~100ms in the past, interpolating between snapshots). You see yourself in the present, others in the past.
- **Interest management** (non-negotiable at scale): only sync entities *near* each player, backed by spatial partitioning (grid / quadtree) — cost otherwise scales players × entities.
- **Transport:** **WebSockets** are TCP (reliable/ordered → head-of-line blocking; fine for chat/lobby/low-rate state); **WebRTC data channels** are UDP (unreliable/unordered, no HOL blocking; better for perishable position updates, at the cost of NAT traversal). **Colyseus** gave me rooms + binary **delta state sync** (only changed fields each patch).

## 4. Gasless onboarding for non-crypto users (wow #2)
The killer requirement: tourists have **no seed phrase, no gas token, no extension** — and shouldn't need any.
- **ERC-4337 account abstraction:** smart-contract accounts with **no protocol change** — a `UserOperation` (signed intent) → alt-mempool → **Bundler** → singleton **EntryPoint** → **Paymaster**. Unlocks batching, session keys, social recovery, and **sponsored gas**.
- **Embedded / social-login wallets (non-custodial, seedless):** email/social → a wallet with **no seed phrase**, where the key is split so no single party holds it — **Web3Auth / Privy (Shamir 2-of-3 in a TEE) / Magic (HSM) / Dynamic (TSS-MPC)**. Custody-grade security with a Web2 recovery experience.
- **Paymasters (the gasless part):** a **verifying paymaster** has the *dApp pay gas* so the user pays nothing and needs no native token; an ERC-20 paymaster lets them pay in a stablecoin they hold. Without this, a non-crypto user would have to KYC on an exchange, buy ETH, and bridge before doing anything — conversion dies.
- **EIP-7702 (Pectra, May 2025):** lets an **existing EOA delegate to smart-contract code** — same address/key, now with smart-account powers (sponsored gas, batching, recovery) *without migrating*. Complementary to 4337.
- **Soundbite:** *"A first-time tourist logs in with email, gets a non-custodial smart account with no seed phrase, and mints their passport with zero gas — web3 is invisible."*

## 5. Multi-chain + on-chain identity (wow #3)
- **Three distinct meanings of "multi-chain" — don't conflate them:**
  1. **Independent per-chain deploys** — separate instances, different address per chain (CREATE address depends on deployer+nonce). Simplest, zero interop trust, fragmented state.
  2. **Deterministic same-address (CREATE2)** — address = `f(deployer, salt, bytecode)`, none chain-dependent, so **the same bytecode+salt gives the identical address on every EVM chain** (via the **Safe Singleton Factory** — the older Arachnid factory used a chain-ID-less tx that Celo/Avalanche reject). **Same address ≠ shared state** — still independent per chain, just portable/predictable.
  3. **Cross-chain messaging** (LayerZero DVNs / Chainlink **CCIP** + Risk Management Network / Wormhole guardians / Hyperlane ISMs) — for actually moving state. Every one reduces to *"who attests the source event happened?"* — that's the trust root.
- **Bridges are the highest-risk component** (say this to a government risk officer): ~**$1.3B lost in 2022** — Ronin ~$600M, Wormhole ~$326M, Nomad ~$190M, all audited. So: **rate limits + independent second-layer verification** (CCIP RMN, multi-DVN), and move state **only where genuinely needed**.
- **The identity stack (the impressive synthesis):** a **soulbound (ERC-5192, non-transferable — `locked()` reverts transfers)** tourism **passport** that is *also* an **ERC-6551 token-bound account** (every NFT gets its own smart account, same address across chains) holding the visitor's **POAP** attendance stamps + credentials, kept **dynamic (ERC-4906 + Chainlink)** as they explore, deployed at the **same CREATE2 address on every chain**, made portable only where required through a **rate-limited, verified** bridge.

## 6. Backend + DevOps at scale
- **Ts.ED:** decorator-driven controllers + DI, with JSON-Schema/OpenAPI at the core. Node is single-threaded so CPU-bound work blocks the loop — scale with `cluster`/containers, offload to `worker_threads`.
- **WebSocket scaling:** **sticky sessions** (Nginx `ip_hash`) so a session hits the same node, plus a **Redis pub/sub adapter** to fan broadcasts across instances — that's how presence/rooms scale horizontally.
- **CDN + Nginx:** 3D assets on a CDN with **content-hashed, immutable** URLs; Nginx as reverse proxy + TLS + HTTP/2 + **WebSocket upgrade** (`Upgrade`/`Connection` via `map`, raised read timeouts). **Brotli** for `.gltf`/`.bin`, but **never re-compress Draco/KTX2** (already compressed). Docker multi-stage builds; Nginx and Node as separate containers.
- **Government product realities:** **Arabic RTL** via CSS logical properties (`margin-inline-start`, etc.) + `next-intl`; and **WCAG 2.2** — a WebGL canvas is opaque to assistive tech, so the 3D view can never be the *only* path to information (non-3D fallbacks, keyboard-operable controls).

## 7. Likely questions → crisp answers
- **"How do you hit 60fps with a whole world on screen?"** → It's draw-call bound, not triangle bound — instancing collapses thousands of objects into single draw calls, LOD drops distant detail, and the assets are Draco+KTX2 compressed so they fit the download *and* VRAM budgets.
- **"Draco or KTX2?"** → Both — Draco shrinks the download (geometry), KTX2 shrinks GPU memory (textures); they solve different bottlenecks.
- **"How does a tourist with no wallet use it?"** → Email/social login → non-custodial embedded smart account (ERC-4337) → a paymaster sponsors gas, so they mint their passport with zero gas and never see a seed phrase.
- **"What does 'multi-chain' actually mean here?"** → Same-address CREATE2 deploys for portability (not shared state), and cross-chain messaging only where state truly needs to move — through a rate-limited, independently-verified bridge, because bridges are the most-exploited part of the stack.
- **"What's the passport?"** → A soulbound ERC-5192 token that's also an ERC-6551 account holding the visitor's POAP stamps and credentials, kept dynamic with ERC-4906.
- **"How did you keep multiplayer smooth?"** → Authoritative server + client prediction + interpolation, and interest management so each client only syncs what's near it.

## 8. Vocabulary to stay fluent
draw-call budget · `InstancedMesh` / drei `<Instances>` · `BatchedMesh` · LOD / three-mesh-bvh · glTF/GLB · Draco · KTX2 / Basis Universal · meshopt · `gltf-transform` · WebGPU / TSL · `dispose()` / context loss · authoritative server · client prediction · reconciliation · entity interpolation · interest management · Colyseus · WebSocket vs WebRTC · VRM / retargeting / IK · ERC-4337 · UserOperation / bundler / EntryPoint / paymaster · embedded wallet (MPC/TSS) · EIP-7702 · CREATE2 / Safe Singleton Factory · LayerZero / CCIP + RMN · ERC-5192 soulbound · ERC-6551 · POAP · ERC-4906 dynamic NFT · Ts.ED · Redis pub/sub adapter · sticky sessions · brotli · Arabic RTL / logical properties · WCAG 2.2 / canvas accessibility.

---
*Keep this private — it's your prep, not website copy.*
