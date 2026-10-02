// The browser:astro project's second setup file: registers astro's mount adapter.
import { mount } from "@unframework/target-astro/toolchain/client";

import { registerTarget } from "../browser/target.ts";

registerTarget("astro", mount);
