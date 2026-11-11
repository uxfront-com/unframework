// The browser:qwik project's second setup file: registers qwik's mount adapter.
import { mount } from "@unframework/target-qwik/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("qwik", mount);
