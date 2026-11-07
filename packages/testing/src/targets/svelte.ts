// The browser:svelte project's last setup file: registers svelte's mount adapter.
import { mount } from "@unframework/target-svelte/toolchain/client";

import { registerTarget } from "../browser/target.ts";

registerTarget("svelte", mount);
