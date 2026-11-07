// The browser:solid project's last setup file: registers solid's mount adapter.
import { mount } from "@unframework/target-solid/toolchain/client";

import { registerTarget } from "../browser/target.ts";

registerTarget("solid", mount);
