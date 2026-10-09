import { provide } from "unframework";
import type { InjectionKey } from "unframework";

import Badge from "./Badge.uf.tsx";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey: InjectionKey<Theme> = Symbol("uf.theme");

export default function ThemeProvider() {
  provide(ThemeKey, { accent: "teal", label: "Teal" });
  return (
    <section aria-label="Themed">
      <Badge text="New" />
    </section>
  );
}
