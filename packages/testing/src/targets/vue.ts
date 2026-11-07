// The browser:vue project's last setup file: registers vue's mount adapter.
import { mount } from "@unframework/target-vue/toolchain/client";

import { registerTarget } from "../browser/target.ts";

registerTarget("vue", mount);
