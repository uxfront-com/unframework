// The browser:react project's second setup file: registers react's mount adapter.
import { mount } from "@unframework/target-react/toolchain/client";

import { registerTarget } from "../internal.ts";

registerTarget("react", mount);
