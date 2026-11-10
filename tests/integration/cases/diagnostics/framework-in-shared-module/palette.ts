// A module the shared module reaches. It imports a framework, which no other target's output can
// load: keep it to plain values, and move what needs React into a composable in a `.uf.ts` module.
import { version } from "react";

export const palette = { blue: `blue-${version}`, red: "red" };
