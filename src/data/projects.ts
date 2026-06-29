// Single source of truth for the Work-section carousel.
// Consumed by ProjectCarousel.astro (markup) and the client scripts
// (image preload, accent tint, hrefs).

export interface Project {
  index: number; // 1..N — displayed zero-padded (01..06)
  client: string; // .card__wordmark + .card__client
  role: string; // sub-label under the client name
  tags: string[]; // .card__tags (triangular bullets)
  year: string; // shown by the counter
  blurb: string; // 1–2 sentences (caption + sr text)
  image: string; // /work-assets/projects/*.webp (gets the distortion shader)
  depth?: string; // optional grayscale depth map → enables 2.5D parallax + idle drift
  href: string | null; // external URL, or null → CTA inert
  accent: string; // hex — per-card accent + shader burst tint
}

export const projects: Project[] = [
  {
    index: 1,
    client: "SEEDVAULT",
    role: "RWA · Smart Contracts",
    tags: ["RWA", "ERC-3643", "SOLIDITY"],
    year: "2026",
    blurb:
      "ERC-3643 security-token platform for fractional ownership of cannabis-seed reserves — ONCHAINID KYC passports, modular compliance and a NAV oracle, deployed on Base.",
    image: "/work-assets/projects/seedvault.webp",
    depth: "/work-assets/projects/seedvault-depth.webp", // PROTOTYPE: 2.5D parallax
    href: null,
    accent: "#3f8f3a",
  },
  {
    index: 2,
    client: "BTC CORE",
    role: "Senior Software Engineer",
    tags: ["BITCOIN", "PSBT", "LENDING"],
    year: "2025",
    blurb:
      "Bitcoin-backed P2P lending — a 2-of-3 multisig escrow built on PSBTs and BIP32/44 derivation, with automated price-triggered liquidations and real-time LTV monitoring.",
    image: "/work-assets/projects/btccore.webp",
    href: null,
    accent: "#f7931a",
  },
  {
    index: 3,
    client: "VELLOS",
    role: "Lead Web3 Developer",
    tags: ["DEFI", "AMM", "SOLIDITY"],
    year: "2025",
    blurb:
      "A DeFi protocol with bonding-curve and AMM mechanics (pump.fun-style), liquidity pools and yield farming — Hardhat/Foundry contracts wired to a React/Next.js front-end.",
    image: "/work-assets/projects/vellos.webp",
    href: null,
    accent: "#7c5cff",
  },
  {
    index: 4,
    client: "CRYPTOWARE",
    role: "Web3 Full-Stack",
    tags: ["NFT", "DEFI", "LAUNCHPAD"],
    year: "2022–23",
    blurb:
      "DAO and DeFi apps plus NFT launches (ERC-721/721A/1155) — $4M in sales across 5,000+ holders — and the OASISX P2P marketplace integration.",
    image: "/work-assets/projects/cryptoware.webp",
    href: null,
    accent: "#2b47ff",
  },
  {
    index: 5,
    client: "SPARTAN",
    role: "Lead Contracts & Frontend",
    tags: ["NFT", "TICKETING"],
    year: "2022",
    blurb:
      "On-chain NFT event ticketing — secure ticket logic and distribution — that reached $5M in sales with 3,500+ pass holders.",
    image: "/work-assets/projects/spartan.webp",
    href: null,
    accent: "#e23b3b",
  },
  {
    index: 6,
    client: "STC",
    role: "Senior Blockchain Dev",
    tags: ["METAVERSE", "MULTI-CHAIN"],
    year: "2023–25",
    blurb:
      "A metaverse for the Saudi Ministry of Tourism — multi-chain Solidity contracts, a React/Next.js UI, a Node.js/TsED backend and Dockerized DevOps.",
    image: "/work-assets/projects/stc.webp",
    href: null,
    accent: "#19a0a0",
  },
];

export const total = projects.length;
