// UF2035 invalid-composable: a composable injects a value. `provide` and `inject` stay in the
// component, whose output each target writes its own way: inject the value there and pass it in.
import { inject } from "unframework";

import { ThemeKey } from "./Theme.uf.tsx";

export function useTheme() {
  const theme = inject(ThemeKey, "light");
  return { theme };
}
