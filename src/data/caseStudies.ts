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
};

export const caseSlugs = Object.keys(caseStudies);
