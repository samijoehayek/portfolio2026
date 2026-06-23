// Single source of truth for the Services-section "laundry line" cards.
// Derived from Samijoe's résumé + the Work-section projects (RWA included).
// Consumed by ServicesSection.astro (markup) and servicesLine.ts (motion).

export interface Service {
  index: number; // 1..N — display order
  code: string; // 3-letter tag code on the hanging clip + giant monogram (BTC, SOL …)
  name: string; // .service-card__name (Anton display)
  date: string; // decorative stamp on the tag (DH uses date stamps)
  markers: string[]; // sub-disciplines timeline (triangles above/below the line)
  journey: [string, string]; // bottom outline word-cycle pair (DH: DES → ART)
  accent: string; // hex — tag + monogram + glassy body + journey tint
}

export const services: Service[] = [
  {
    index: 1,
    code: "BTC",
    name: "BITCOIN ENGINEERING",
    date: "12-24-NOW",
    markers: [
      "Multisig Escrow",
      "PSBTs",
      "BIP32 / 44",
      "Bitcoin Core RPC",
      "LTV Monitoring",
      "Liquidations",
    ],
    journey: ["SIGN", "SETTLE"],
    accent: "#f7931a",
  },
  {
    index: 2,
    code: "SOL",
    name: "SMART CONTRACTS",
    date: "01-22-NOW",
    markers: [
      "Solidity",
      "Hardhat",
      "Foundry",
      "ERC-721 / 1155",
      "Audited Deploys",
      "Multi-chain",
    ],
    journey: ["CODE", "CHAIN"],
    accent: "#7c5cff",
  },
  {
    index: 3,
    code: "DFI",
    name: "DEFI PROTOCOLS",
    date: "09-24-NOW",
    markers: [
      "AMM Design",
      "Bonding Curves",
      "Liquidity Pools",
      "Yield Farming",
      "Tokenomics",
    ],
    journey: ["SWAP", "YIELD"],
    accent: "#19a0a0",
  },
  {
    index: 4,
    code: "RWA",
    name: "RWA TOKENIZATION",
    date: "26-26-NEW",
    markers: [
      "ERC-3643",
      "ONCHAINID KYC",
      "Compliance Modules",
      "NAV Oracles",
      "Fractional Ownership",
    ],
    journey: ["REAL", "ONCHAIN"],
    accent: "#3f8f3a",
  },
  {
    index: 5,
    code: "WEB",
    name: "FULL-STACK WEB",
    date: "22-22-NOW",
    markers: [
      "React / Next.js",
      "Node.js",
      "NestJS / TsED",
      "REST + WebSocket",
      "Postgres / Mongo",
    ],
    journey: ["APP", "API"],
    accent: "#2b47ff",
  },
  {
    index: 6,
    code: "NFT",
    name: "NFT & LAUNCHPADS",
    date: "22-23-OUT",
    markers: [
      "ERC-721A / 1155",
      "Launchpads",
      "Ticketing",
      "Marketplaces",
      "$9M+ Sales",
    ],
    journey: ["MINT", "LAUNCH"],
    accent: "#e23b3b",
  },
  {
    index: 7,
    code: "OPS",
    name: "DEVOPS & INFRA",
    date: "21-21-RUN",
    markers: [
      "Docker",
      "Nginx",
      "Ubuntu",
      "Multi-chain Deploy",
      "CI / CD",
      "Monitoring",
    ],
    journey: ["BUILD", "SHIP"],
    accent: "#ffae00",
  },
];

export const total = services.length;
