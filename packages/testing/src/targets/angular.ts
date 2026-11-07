// The browser:angular project's last setup file: registers angular's mount adapter.
import { mount } from "@unframework/target-angular/toolchain/client";

import { registerTarget } from "../browser/target.ts";

registerTarget("angular", mount);
