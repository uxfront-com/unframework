// The browser:vue project's second setup file: registers vue's mount adapter.
import { mount } from "@unframework.dev/target-vue/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("vue", mount);
