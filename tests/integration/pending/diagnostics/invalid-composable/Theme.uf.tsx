// The component that declares the key. It doesn't call the composable, so only the composable's
// own diagnostic is reported.
import type { InjectionKey } from "unframework";

export const ThemeKey: InjectionKey<string> = Symbol("theme");

export default function Theme() {
  return <p>Theme</p>;
}
