# Loom script — STC national tourism metaverse (architecture walkthrough)

**Target length:** ~2:15 · **Goal:** it's a government project under NDA with no public build, so this is a **narrated architecture walkthrough** — screen-share the two diagrams (the 3D stack, then the onboarding/identity flow) and tell the story of a national tourism metaverse built for people who aren't crypto users.

**Before you record**
- Open the two STC diagrams (the real-time 3D stack, then the gasless-onboarding → passport flow).
- Nothing confidential to leak — you're explaining architecture and standards, not client code or assets.

---

### 0:00–0:15 — Hook
- **Screen:** the top of the case-study page.
- **Say:** "This was a national tourism metaverse for the Saudi Ministry of Tourism — a real-time, multi-user 3D world that runs in a browser tab, with an on-chain identity layer. The whole thing is shaped by one constraint: the users are tourists, not crypto natives. Let me walk the architecture."

### 0:15–0:50 — Making 3D run in a browser (the perf story)
- **Screen:** the stack diagram, point at Client → Assets.
- **Say:** "Browser 3D is CPU-bound on draw calls, not GPU-bound on triangles — so a photoreal world falls over above a few hundred draw calls. The lever is **instancing**: thousands of trees or buildings that share geometry render in a *single* draw call instead of thousands, plus LOD so distant objects drop detail. And the assets go through a two-part compression pipeline — **Draco shrinks the download** by ~90% on geometry, and **KTX2 shrinks the GPU memory** 4–8× because a normal 2K texture is 16MB in VRAM regardless of file size. You need both to hold 60fps on a tourist's phone."

### 0:50–1:15 — Multi-user in real time
- **Screen:** the Presence Server box.
- **Say:** "It's multi-user, so there's an authoritative presence server — I used Colyseus. Clients send *inputs*, not results; the client predicts its own movement so there's no input lag, and renders everyone else slightly in the past, interpolating between snapshots so motion stays smooth. The key scaling trick is **interest management** — you only sync entities near a given player, not the whole world — and it scales horizontally with a Redis pub/sub adapter behind sticky sessions."

### 1:15–1:50 — Making web3 invisible (the onboarding wow)
- **Screen:** the identity diagram, left→right across the onboarding row.
- **Say:** "Here's the part I'm proudest of. A tourist logs in with **email or social** — no seed phrase. That gives them a **non-custodial embedded wallet**, and an **ERC-4337 smart account**. When they mint their digital passport or collect a landmark stamp, a **paymaster sponsors the gas** — so they pay nothing and never need a gas token. A first-time, non-crypto user does a real on-chain action in seconds and never sees a wallet, a seed phrase, or a fee."

### 1:50–2:10 — The passport + multi-chain
- **Screen:** the Passport → Multi-chain boxes.
- **Say:** "The identity itself is a **soulbound passport** — ERC-5192, non-transferable — that's *also* an ERC-6551 token-bound account, so it can hold the visitor's POAP attendance stamps and credentials, and stay dynamic as they explore. It's deployed at the **same CREATE2 address on every chain** for portability, and I only move state cross-chain where genuinely needed — through a rate-limited, independently-verified bridge, because bridges are the most-exploited part of the whole stack and a government client needs to hear that risk stated plainly."

### 2:10–2:20 — Close
- **Say:** "Real-time 3D that runs anywhere, seamless multiplayer, and a web3 identity layer a non-crypto tourist never has to think about. That was STC."

---

**Editing tips:** the two diagrams carry it — keep pointing at the box you're on. If you need it shorter, lead with the three wow beats: instancing + Draco/KTX2 → gasless onboarding → soulbound multi-chain passport. Drop the Loom URL into `src/data/caseStudies.ts` → `stc.links[0].href` **and** the `video` gallery block `src`.
