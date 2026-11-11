// The browser:astro project's second setup file: registers astro's mount adapter.
import { mount } from "@unframework.dev/target-astro/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("astro", mount);
