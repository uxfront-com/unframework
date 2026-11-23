// The browser:ember project's second setup file: registers ember's mount adapter.
import { mount } from "@unframework.dev/target-ember/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("ember", mount);
