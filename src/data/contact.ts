// Contact — the "READY TO PLAY?" sign-off as one big horizontal guitar you can
// hover-strum. Edit copy + links here.
export const contact = {
  // Split into characters for the curve-following arched title.
  titleWords: ["READY", "TO", "PLAY?"],
  links: [
    { label: "Email", value: "samijoehayek1@gmail.com", href: "mailto:samijoehayek1@gmail.com" },
    { label: "Phone", value: "+961 70 746 299", href: "tel:+96170746299" },
  ],
  // Six strings, low → high, standard tuning. Order = top string → bottom string.
  // freq drives the Karplus–Strong synth; key is an optional keyboard shortcut.
  strings: [
    { note: "E2", freq: 82.41, key: "1" },
    { note: "A2", freq: 110.0, key: "2" },
    { note: "D3", freq: 146.83, key: "3" },
    { note: "G3", freq: 196.0, key: "4" },
    { note: "B3", freq: 246.94, key: "5" },
    { note: "E4", freq: 329.63, key: "6" },
  ],
} as const;

export type ContactString = (typeof contact.strings)[number];
