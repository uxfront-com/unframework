// The browser:solid2 project's second setup file: registers Solid 2's mount adapter, which throws
// as it loads if the project resolved Solid 1 (ADR-0102).
import { mount } from "@unframework.dev/target-solid2/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("solid2", mount);
