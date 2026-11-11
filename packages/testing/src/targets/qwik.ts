// The browser:qwik project's second setup file: registers qwik's mount adapter.
import { mount } from "@unframework.dev/target-qwik/toolchain/client";

import { registerTarget } from "../browser/target.ts";

registerTarget("qwik", mount);
