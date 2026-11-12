// The paper the results page is printed on (uiStore researchPaper: "white" | "dark").

import { THEMES } from "../data/constants.js";

// White paper is the Paper theme with a pure white page. Dark paper is the app's
// own theme when that is dark, otherwise Plasticity.
export function paperTheme(mode, t) {
  if (mode === "dark") return t.id === "paper" || t.id === "light" ? THEMES.bluish : t;
  return { ...THEMES.paper, surf2: "#ffffff" };
}
export const sheetBackground = (mode, pt) => (mode === "dark" ? pt.surf : "#ffffff");
