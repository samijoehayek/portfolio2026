// Content for the About "stadium" section (the ABOUT card that flies in near the
// end of the fly-into-the-stadium scroll). The stadium structure itself is
// generated/authored in code; this file is only the human-facing copy + the
// scoreboard model.
//
// NOTE: all copy below is a first DRAFT for Samijoe / SajeLabs — refine freely.

export const about = {
  // big display heading on the card
  heading: "ABOUT",

  // two short bio paragraphs (BIO column)
  bio: [
    "I'm a full-stack engineer running SajeLabs, building products end to end — " +
      "from the smart contracts and back-end services to the interface that ties " +
      "them together. Blockchain, back-end, front-end: one mind, the whole pitch.",
    "Whether it's architecting a system from ground zero, shipping production " +
      "Bitcoin/Ethereum infrastructure, or crafting an interface people actually " +
      "enjoy, I help teams turn an idea into something live.",
  ],

  // ROSTER column — clients / projects / collaborators (drafted; swap for real ones)
  roster: [
    "BTC-Backed Lending",
    "SajeLabs",
    "CryptoSwift",
    "Higgsfield",
    "Independent Founders",
    "DeFi Protocols",
    "Early-stage Startups",
    "Web3 Studios",
  ],

  // the live scoreboard (ticks up when you kick the ball into a goal — Pass 2)
  score: {
    homeLabel: "HOME",
    awayLabel: "AWAY",
    home: 0,
    away: 0,
  },

  // awards / recognition ticker (the looping marquee under the card)
  awards: [
    "Full-Stack",
    "Blockchain",
    "Bitcoin · PSBT",
    "Solidity",
    "NestJS",
    "React · Astro",
    "Three.js · GSAP",
    "System Design",
    "Production Launches",
    "DeFi",
    "Web3",
    "Open Source",
  ],
} as const;

export type About = typeof about;
