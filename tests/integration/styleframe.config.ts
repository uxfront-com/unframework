// The corpus's Styleframe configuration (ADR-0064): the tokens, utilities, recipes and themes the
// `styleframe/` and `theming/` cases use, loaded by Styleframe's plugin in every ssr and browser
// project (`harness/styleframe.ts`). Community only: building it needs no licence key.
import {
  useBackgroundColorUtility,
  useBorderRadiusUtility,
  useColorUtility,
  usePaddingUtility,
} from "@styleframe/theme";
import { styleframe } from "styleframe";

const s = styleframe();
const { variable, ref, recipe, media, theme } = s;

const colorPrimary = variable("color.primary", "rgb(29, 78, 216)");
const colorOnPrimary = variable("color.on-primary", "rgb(255, 255, 255)");
const colorSurface = variable("color.surface", "rgb(243, 244, 246)");
const colorText = variable("color.text", "rgb(17, 24, 39)");
const spacingSm = variable("spacing.sm", "4px");
const spacingMd = variable("spacing.md", "8px");
const spacingLg = variable("spacing.lg", "16px");
const radiusMd = variable("radius.md", "6px");

useBackgroundColorUtility(s, { primary: ref(colorPrimary), surface: ref(colorSurface) });
useColorUtility(s, { "on-primary": ref(colorOnPrimary), text: ref(colorText) });
usePaddingUtility(s, { sm: ref(spacingSm), md: ref(spacingMd), lg: ref(spacingLg) });
useBorderRadiusUtility(s, { md: ref(radiusMd) });

recipe({
  name: "badge",
  base: {
    backgroundColor: "@color.primary",
    color: "@color.on-primary",
    padding: "@spacing.sm",
    borderRadius: "@radius.md",
  },
});

recipe({
  name: "button",
  base: { borderRadius: "@radius.md" },
  variants: {
    size: { sm: { padding: "@spacing.sm" }, lg: { padding: "@spacing.lg" } },
    tone: {
      neutral: { backgroundColor: "@color.surface", color: "@color.text" },
      primary: { backgroundColor: "@color.primary", color: "@color.on-primary" },
    },
  },
  defaultVariants: { size: "sm", tone: "neutral" },
});

// The dark colour scheme, which a case opts into with `"colorScheme": "dark"`.
media("(prefers-color-scheme: dark)", ({ selector }) => {
  selector(":root", ({ variable: set }) => {
    set(colorSurface, "rgb(31, 41, 55)");
    set(colorText, "rgb(249, 250, 251)");
  });
});

// The dark theme, which `data-theme="dark"` applies to an element and its descendants.
theme("dark", ({ variable: set }) => {
  set(colorSurface, "rgb(31, 41, 55)");
  set(colorText, "rgb(249, 250, 251)");
});

export default s;
