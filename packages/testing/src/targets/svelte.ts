// The browser:svelte project's second setup file: registers svelte's mount adapter.
import { mount } from "@unframework.dev/target-svelte/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("svelte", mount);
