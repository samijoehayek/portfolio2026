// Case-study content for the /work/[slug] detail pages (SAM-14).
// Keyed by the `slug` on each Project in projects.ts. A project only gets a
// live "VIEW WORK" link once it has an entry here — so we can ship the pages
// one at a time (BTC BACKED first) without dead CTAs on the rest.

export type MediaKind = "image" | "diagram" | "video";
export type FrameKind = "browser" | "device" | "none";

export interface MediaBlock {
  kind: MediaKind;
  /** image path (/work-assets/…) or, for kind:"video", a Loom/YouTube embed URL */
  src?: string;
  /** for kind:"diagram" — which diagram component to render (see [slug].astro map) */
  diagram?: string;
  /** shown while a video slot is still awaiting its embed URL */
  placeholder?: string;
  alt?: string;
  caption?: string;
  frame?: FrameKind; // chrome to wrap the media in
}

export type LinkKind = "primary" | "secondary" | "tertiary";

export interface CaseLink {
  label: string;
  href: string | null; // null → rendered as an inert, labelled slot (no dead link)
  kind: LinkKind;
  note?: string; // small print under the button (e.g. "sign-in required")
  external?: boolean;
}

export interface CaseStudy {
  slug: string;
  client: string; // wordmark
  title: string; // hero one-liner
  role: string;
  year: string;
  accent: string; // per-project accent (matches projects.ts)
  tags: string[];
  /** one honest, confident line about confidentiality */
  privacyNote?: string;
  overview: string; // the single DESCRIPTION paragraph (Dave-style)
  contributions: string[]; // "what I owned" — the engineering story
  trust?: { label: string; value: string }[]; // sanitized badges/metrics
  links: CaseLink[];
  gallery: MediaBlock[];
}

export const caseStudies: Record<string, CaseStudy> = {
  "btc-backed": {
    slug: "btc-backed",
    client: "BTC BACKED",
    title: "The Swiss standard for Bitcoin-backed lending",
    role: "Senior Software Engineer",
    year: "2025",
    accent: "#f7931a",
    tags: ["BITCOIN", "PSBT", "MULTISIG", "LENDING"],
    privacyNote:
      "Private repository. The live product and a full architecture walkthrough are below.",
    overview:
      "A non-custodial, Swiss-grade peer-to-peer marketplace for Bitcoin-backed loans. Borrowers unlock liquidity without selling their BTC and lenders earn yield secured by over-collateralised Bitcoin — without either side surrendering custody of their keys. Collateral lives in a 2-of-3 multi-signature escrow enforced by code, never in a company wallet, and is never reused or rehypothecated.",
    contributions: [
      "Designed and built the 2-of-3 multi-signature escrow on PSBTs — collateral is locked between borrower, lender and protocol, so no single party (including the platform) can move funds unilaterally.",
      "Implemented BIP32/44 HD key derivation and signing flows for deterministic, per-loan escrow addresses.",
      "Built automated, price-triggered liquidations wired to real-time LTV monitoring, so under-collateralised positions unwind by protocol rule rather than manual intervention.",
      "Delivered the end-to-end lending marketplace — offer/request matching, loan lifecycle, and the borrower & lender dashboards — under a Swiss VQF-regulated framework.",
    ],
    trust: [
      { label: "Custody", value: "Non-custodial · 2-of-3 multisig" },
      { label: "Jurisdiction", value: "Swiss-based · Crypto Valley, Zug" },
      { label: "Regulation", value: "VQF member (#101306)" },
      { label: "Collateral", value: "Over-collateralised · rehypothecation-free" },
    ],
    links: [
      {
        label: "Visit the site",
        href: "https://btcbacked.com/",
        kind: "primary",
        external: true,
      },
      {
        label: "Watch the walkthrough",
        href: null, // ← Loom of the app flow goes here once recorded
        kind: "secondary",
        note: "2-min product walkthrough — video coming",
      },
      {
        label: "Open the live app",
        href: "https://app.btcbacked.com/sign-in",
        kind: "tertiary",
        note: "Live product — sign-in required",
        external: true,
      },
    ],
    gallery: [
      {
        kind: "image",
        src: "/work-assets/projects/btcbacked/marketing-hero.jpg",
        alt: "BTCBacked marketing site showing the borrower dashboard on desktop and mobile",
        caption: "btcbacked.com — the marketing site & product dashboard",
        frame: "browser",
      },
      {
        kind: "diagram",
        diagram: "escrow",
        caption: "How the non-custodial 2-of-3 multisig escrow works",
        alt: "Architecture diagram: borrower and lender fund a 2-of-3 multisig escrow; a price oracle feeds an LTV monitor that can trigger liquidation.",
      },
      {
        kind: "video",
        placeholder:
          "Loom walkthrough of a live borrow → escrow → repay flow. Record it and drop the embed URL into caseStudies.ts.",
        caption: "Product walkthrough (Loom)",
        frame: "browser",
      },
      {
        kind: "image",
        src: "/work-assets/projects/btccore.webp",
        alt: "BTC Backed key visual",
        caption: "Key visual",
        frame: "none",
      },
    ],
  },

  seedvault: {
    slug: "seedvault",
    client: "SEEDVAULT",
    title: "A compliant, on-chain security token for real-world seed reserves",
    role: "Lead Contracts & Full-Stack",
    year: "2026",
    accent: "#5b8ad4",
    tags: ["ERC-3643", "ONCHAINID", "SOLIDITY", "BASE"],
    privacyNote:
      "The repositories are private — but the contracts are public and source-verified on Base mainnet. Explore the real thing below.",
    overview:
      "SeedVault (SVLT) is an ERC-3643 (T-REX) security token representing fractional ownership of real-world agricultural seed reserves. It is a permissioned token: every transfer, mint and forced-transfer is gated on-chain by a modular compliance engine and an ONCHAINID identity check, so shares can only ever move between KYC-verified, allow-listed holders. Deployed and source-verified on Base mainnet.",
    contributions: [
      "Built the full ERC-3643 (T-REX) token suite — the SVLT token delegates every transfer/mint to a ModularCompliance engine and a triple identity registry, so compliance is enforced by the contract itself, not by a trusted backend.",
      "Implemented on-chain KYC with ONCHAINID: each investor gets a digital-passport identity contract holding claims signed by a trusted issuer, and IdentityRegistry.isVerified() gates every transfer.",
      "Wrote the modular compliance layer with a plug-and-play country-allowlist module (ISO country codes) — new rules can be bound without redeploying the token.",
      "Added a NAV oracle (NAVStore, 8-decimal net asset value per token) and an append-only, IPFS-backed DocumentsRegistry for on-chain document provenance.",
      "Built an ONCHAINID factory on EIP-1167 minimal-proxy clones with deterministic CREATE2 addresses — cheap identity issuance at scale.",
      "Designed the V2 'burn-disabled' token: supply is immutable, and redemptions or enforcement run through a treasury forced-transfer pattern instead of ever destroying shares.",
      "Shipped the whole system to Base mainnet with a 6-phase Hardhat Ignition deployment, then handed every owner/admin role to the client via Ownable2Step + AccessControl — the deployer ends with zero privilege.",
      "Built the admin dashboard (Next.js 16 · Wagmi · Viem · RainbowKit) — 12 pages to manage identities, compliance, NAV, documents and minting, with a 7-role access model and batched on-chain reads.",
    ],
    trust: [
      { label: "Standard", value: "ERC-3643 (T-REX) · ONCHAINID" },
      { label: "Network", value: "Base mainnet · source-verified" },
      { label: "Compliance", value: "On-chain KYC · country allowlist" },
      { label: "Handover", value: "All roles to client · Ownable2Step" },
    ],
    links: [
      {
        label: "View the verified token",
        href: "https://basescan.org/address/0x84376a6fb9419E0b018977b15533408d5430065B#code",
        kind: "primary",
        external: true,
      },
      {
        label: "Watch the walkthrough",
        href: null, // ← Loom of the admin dashboard goes here once recorded
        kind: "secondary",
        note: "Admin-dashboard walkthrough — video coming",
      },
      {
        label: "Browse the contract suite",
        href: "https://basescan.org/address/0xbEDeE3c86C6ceDCd6A2825D2F9Cb37A33cDE1254",
        kind: "tertiary",
        note: "ModularCompliance + 12 more, all on Base",
        external: true,
      },
    ],
    gallery: [
      {
        kind: "diagram",
        diagram: "seedvault-compliance",
        caption: "How every transfer is gated — compliance + identity, enforced on-chain",
        alt: "Architecture diagram: an SVLT transfer is checked by ModularCompliance (country allowlist) and IdentityRegistry.isVerified, which resolves through the T-REX triple registry to the receiver's ONCHAINID KYC claims before value can move.",
      },
      {
        kind: "diagram",
        diagram: "seedvault-contracts",
        caption: "The full contract suite — live and source-verified on Base mainnet",
        alt: "A map of the 13 deployed SeedVault contracts on Base mainnet, each linking to its verified source on BaseScan.",
      },
      {
        kind: "video",
        placeholder:
          "Loom walkthrough of the admin dashboard: create an ONCHAINID identity, register a KYC-verified investor, update the NAV, and mint SVLT. Record it and drop the embed URL into caseStudies.ts.",
        caption: "Admin-dashboard walkthrough (Loom)",
        frame: "browser",
      },
      {
        kind: "image",
        src: "/work-assets/projects/seedvault.webp",
        alt: "SeedVault key visual",
        caption: "Key visual",
        frame: "none",
      },
    ],
  },

  vellos: {
    slug: "vellos",
    client: "VELLOS",
    title: "A fair-launch bonding-curve token platform on Ethereum",
    role: "Lead Web3 Developer",
    year: "2025",
    accent: "#3fb56a",
    tags: ["DEFI", "BONDING CURVE", "AMM", "SOLIDITY"],
    privacyNote:
      "Built under confidentiality — the source and contracts were kept private at the client's request, and the platform is no longer live. Here's how it works.",
    overview:
      "Vellos is a pump.fun-style fair-launch platform on Ethereum. Anyone can launch a token that trades instantly on an on-chain bonding curve — price rises as demand buys in and falls as holders sell, with no seeded liquidity and no team allocation. When a token's curve fills, its liquidity graduates automatically into an AMM pool. A live TradingView chart is driven directly from on-chain trades through an oracle- and WebSocket-backed price pipeline.",
    contributions: [
      "Designed and built the bonding-curve contracts in Solidity — a constant-product, virtual-reserve curve where price is set purely by supply and demand (a buy pushes price up, a sell pulls it down), with no pre-seeded liquidity.",
      "Derived the curve math from the white papers: the closed-form cost/proceeds for any trade against the virtual reserves (X·Y = k), so every buy and sell prices deterministically on-chain.",
      "Built a token factory that launches each coin and its curve as a cheap minimal-proxy clone with deterministic addresses.",
      "Implemented automatic graduation — once a curve sells out, the accumulated liquidity migrates into an AMM pool and the LP is locked, so trading continues seamlessly off the curve.",
      "Built the real-time price pipeline: an indexer streams the on-chain buy/sell events, aggregates them into OHLC candles, and pushes them over WebSockets to a TradingView chart fed straight from contract data.",
      "Wired a Chainlink ETH/USD oracle to turn on-chain ETH reserves into a live USD market cap — used for both the graduation threshold and the UI.",
      "Delivered the React/Next.js trading front-end: wallet connect, buy/sell with slippage, and the live candlestick chart.",
    ],
    trust: [
      { label: "Chain", value: "Ethereum · Solidity" },
      { label: "Curve", value: "Constant-product · virtual reserves" },
      { label: "Pricing", value: "100% on-chain · no seeded LP" },
      { label: "Live data", value: "On-chain events → TradingView" },
    ],
    links: [
      {
        label: "Watch the walkthrough",
        href: null, // ← Loom explaining how it works goes here once recorded
        kind: "primary",
        note: "How it works — architecture walkthrough coming",
      },
    ],
    gallery: [
      {
        kind: "diagram",
        diagram: "vellos-curve",
        caption: "The bonding curve — price is pure supply & demand, then liquidity graduates to an AMM",
        alt: "A price-vs-supply bonding curve: as tokens sell the price rises along a constant-product curve; when the curve fills, liquidity migrates to a Uniswap pool with the LP locked.",
      },
      {
        kind: "diagram",
        diagram: "vellos-pipeline",
        caption: "How the live TradingView chart is driven straight from on-chain trades",
        alt: "Data pipeline: the bonding-curve contract emits buy/sell events, an indexer aggregates them into OHLC candles, a WebSocket streams them to a TradingView chart, and a Chainlink ETH/USD oracle provides the USD market cap.",
      },
      {
        kind: "video",
        placeholder:
          "Loom walkthrough of the architecture: launch a token, trade it up the bonding curve, watch the live chart move, and hit graduation into the AMM. Record it and drop the embed URL into caseStudies.ts.",
        caption: "Architecture walkthrough (Loom)",
        frame: "browser",
      },
      {
        kind: "image",
        src: "/work-assets/projects/vellos.webp",
        alt: "Vellos key visual",
        caption: "Key visual",
        frame: "none",
      },
    ],
  },

  cryptoware: {
    slug: "cryptoware",
    client: "CRYPTOWARE",
    title: "Two years shipping NFT, launchpad & marketplace products at Web3 scale",
    role: "Web3 Full-Stack Developer",
    year: "2022–23",
    accent: "#12a5cf",
    tags: ["NFT", "LAUNCHPAD", "MARKETPLACE", "SOLIDITY"],
    privacyNote:
      "Agency-era work across many private client repos — no single live site, so the engineering (and the impact) is the story here.",
    overview:
      "Cryptoware was my Web3 agency era — two years shipping production NFT, launchpad, marketplace, DeFi and DAO products end to end, contracts plus React front-ends. I launched NFT collections across ERC-721 / 721A / 1155 (over $4M in sales and 5,000+ holders), built a launchpad that deployed 80 collections as cheap minimal-proxy clones ($300K+ raised), and integrated the audited contracts behind OASISX, a MENA peer-to-peer digital-asset marketplace.",
    contributions: [
      "Launched NFT collections on ERC-721 / 721A / 1155 — using ERC-721A's batch-mint storage design (owner written once per batch, resolved lazily on read) to cut mint gas by roughly 86% on large public drops, while reasoning about the higher transfer cost that comes with it.",
      "Gated presales with both Merkle-tree allowlists (a single 32-byte root on-chain, verified by proof) and EIP-712 signature vouchers (backend-signed, recovered on-chain) — phased mints (allowlist → public) with per-wallet and supply caps, reentrancy-guarded.",
      "Made reveals provably fair: a committed provenance hash plus a Chainlink VRF randomized starting index, so no one — the team included — could snipe rares before reveal; metadata pinned to IPFS.",
      "Handled royalties across the whole 2022–23 shift — EIP-2981, the OpenSea operator-filter era, and the move toward ERC-721C creator-enforced royalties.",
      "Built the launchpad engine: a factory that deploys a fresh ERC-721/1155/20 per launch as an EIP-1167 minimal-proxy clone (deterministic CREATE2 addresses, Initializable templates, no constructor) — 80 launches, $300K+ raised.",
      "Integrated the audited contracts behind OASISX — an escrow-less, approvals-based marketplace where sellers sign EIP-712 orders off-chain (no gas) and the settlement contract verifies the signature and atomically moves the NFT and splits payment across seller, platform fee and royalty.",
      "Shipped adjacent DeFi and DAO pieces — staking/farming on the O(1) reward-per-token accumulator pattern, swaps/AMM and arbitrage flows, and OpenZeppelin Governor + Timelock governance.",
      "Delivered the React front-ends across all of it — mint UIs, marketplace flows and wallet UX wired with ethers.js / Wagmi.",
    ],
    trust: [
      { label: "Impact", value: "$4M+ sales · 5,000+ holders" },
      { label: "Standards", value: "ERC-721A · 1155 · EIP-2981" },
      { label: "Reveal", value: "Provenance + Chainlink VRF" },
      { label: "Marketplace", value: "EIP-712 signed orders (OASISX)" },
    ],
    links: [
      {
        label: "Watch the walkthrough",
        href: null, // ← Loom of the agency-era work goes here once recorded
        kind: "primary",
        note: "Engineering walkthrough — video coming",
      },
    ],
    gallery: [
      {
        kind: "diagram",
        diagram: "cryptoware-stats",
        caption: "The commercial footprint across the agency era",
        alt: "Impact figures: over $4M in NFT sales, 5,000+ unique holders, 80 token launches, $300K+ raised.",
      },
      {
        kind: "diagram",
        diagram: "cryptoware-launch",
        caption: "The NFT launch engine — clone factory → gas-lean ERC-721A mint → provably-fair reveal",
        alt: "Architecture: a launchpad factory clones an ERC-721A collection per launch; the collection runs a phased Merkle/signature-gated mint, a provenance + Chainlink VRF reveal, and EIP-2981/ERC-721C royalties.",
      },
      {
        kind: "diagram",
        diagram: "cryptoware-market",
        caption: "OASISX — escrow-less P2P trading on off-chain signed orders",
        alt: "A seller signs an EIP-712 order off-chain; a buyer fulfils it; the settlement contract verifies the signature and atomically moves the NFT and splits payment between seller, platform fee and royalty.",
      },
      {
        kind: "video",
        placeholder:
          "Loom walkthrough of the agency-era work: the NFT launch engine, a phased Merkle-gated mint, the VRF reveal, and the OASISX signed-order marketplace. Record it and drop the embed URL into caseStudies.ts.",
        caption: "Engineering walkthrough (Loom)",
        frame: "browser",
      },
      {
        kind: "image",
        src: "/work-assets/projects/cryptoware.webp",
        alt: "Cryptoware key visual",
        caption: "Key visual",
        frame: "none",
      },
    ],
  },

  stc: {
    slug: "stc",
    client: "STC",
    title: "A national tourism metaverse — real-time 3D on the web, multi-chain underneath",
    role: "Senior Full-Stack & Blockchain Developer",
    year: "2023–25",
    accent: "#7b4fd1",
    tags: ["METAVERSE", "3D WEB", "MULTI-CHAIN", "SOLIDITY"],
    privacyNote:
      "A government project under NDA — no public build, source or contracts. What's here is the architecture and the engineering; a deeper walkthrough on request.",
    overview:
      "A national tourism metaverse for the Saudi Ministry of Tourism — a browser-based, multi-user 3D world with an on-chain identity and collectibles layer. I led it full-stack across the real-time 3D client, a multi-chain smart-contract layer, a Node.js/Ts.ED backend and the production DevOps — under one constraint that shaped every decision: the users are tourists, not crypto natives.",
    contributions: [
      "Led the browser 3D client (React/Next.js + Three.js / React Three Fiber) — holding 60fps on a photoreal world by collapsing thousands of draw calls into a handful with instancing (InstancedMesh / drei Instances), plus LOD and culling.",
      "Built the 3D asset pipeline: FBX → glTF, Draco geometry compression (~90% smaller downloads) and KTX2 / Basis GPU-texture compression (4–8× less VRAM) — because Draco shrinks the download and KTX2 shrinks the GPU memory, and a tourist on a phone needs both.",
      "Made web3 invisible for non-crypto users: email/social login → a non-custodial embedded wallet (no seed phrase) → an ERC-4337 smart account with a paymaster sponsoring gas, so a first-timer mints their passport and collects landmark POAPs without ever seeing a seed phrase or a gas token.",
      "Designed the on-chain identity: a soulbound (ERC-5192, non-transferable) tourism passport that doubles as an ERC-6551 token-bound account holding the visitor's POAP attendance stamps and credentials, kept dynamic (ERC-4906) as they explore.",
      "Architected the multi-chain deployment: the same contracts at a deterministic CREATE2 address on every EVM chain, moving state cross-chain only where genuinely needed through rate-limited, independently-verified messaging — with an explicit, honest risk posture, since bridges are the most-exploited part of the stack.",
      "Built the real-time multiplayer layer: an authoritative presence server (Colyseus) with client-side prediction, entity interpolation and interest management (only syncing what's near you), scaled with a Redis pub/sub adapter behind sticky sessions.",
      "Owned the Node.js/Ts.ED backend and the production DevOps — Dockerized services behind Nginx (TLS, HTTP/2, WebSocket upgrade, brotli for glTF), assets served from a CDN with content-hashed, immutable caching.",
      "Shipped it as a government product: Arabic RTL and i18n throughout, and non-3D fallbacks so it meets WCAG accessibility — a WebGL canvas is opaque to assistive tech, so it can never be the only path to information.",
    ],
    trust: [
      { label: "Client", value: "Saudi Ministry of Tourism" },
      { label: "Experience", value: "Real-time 3D · multi-user" },
      { label: "Onboarding", value: "Gasless · no seed phrase" },
      { label: "Identity", value: "Soulbound multi-chain passport" },
    ],
    links: [
      {
        label: "Watch the walkthrough",
        href: null, // ← Loom of the architecture goes here once recorded
        kind: "primary",
        note: "Architecture walkthrough — video coming",
      },
    ],
    gallery: [
      {
        kind: "diagram",
        diagram: "stc-stack",
        caption: "How a photoreal, multi-user world runs inside a browser tab",
        alt: "Architecture: a React/R3F browser 3D client with instancing and LOD, fed by a CDN of Draco/KTX2-compressed glTF assets, a Colyseus presence server with interest management, and a Ts.ED backend behind Nginx/Docker.",
      },
      {
        kind: "diagram",
        diagram: "stc-identity",
        caption: "Making web3 invisible — gasless onboarding to a soulbound, multi-chain passport",
        alt: "A tourist logs in with email/social, gets a non-custodial embedded wallet and an ERC-4337 smart account with a paymaster, and mints a soulbound ERC-5192 passport that is also an ERC-6551 account holding POAPs, deployed at the same CREATE2 address across chains.",
      },
      {
        kind: "video",
        placeholder:
          "Loom walkthrough of the architecture: the real-time 3D stack (instancing + Draco/KTX2), the gasless onboarding flow, and the soulbound multi-chain passport. Record it and drop the embed URL into caseStudies.ts.",
        caption: "Architecture walkthrough (Loom)",
        frame: "browser",
      },
      {
        kind: "image",
        src: "/work-assets/projects/stc.webp",
        alt: "STC metaverse key visual",
        caption: "Key visual",
        frame: "none",
      },
    ],
  },
};

export const caseSlugs = Object.keys(caseStudies);
