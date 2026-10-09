import { inject } from "unframework";

import { ThemeKey } from "./ThemeProvider.uf.tsx";

export default function Badge({ text }: { text: string }) {
  const theme = inject(ThemeKey);
  return (
    <span class={["badge", theme?.accent]}>
      {text} in {theme?.label ?? "no theme"}
    </span>
  );
}
