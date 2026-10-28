// A shared module: plain values, which every component's outputs read from their copy of it.
import { palette } from "./palette.ts";

export const tones = { info: palette.blue, danger: palette.red };
