// The Vue target's Vapor mount adapter (ADR-0112), which throws as it loads if the project
// resolved a Vue older than 3.6. It registers for the project's own target: `vue-vapor` in the
// corpus's browser:vue-vapor project, and `vue` in a project whose `targetOptions` turn `vapor`
// on (`defineTestConfig`).
import { mount } from "@unframework.dev/target-vue/toolchain/vapor/client";

import { currentTarget } from "../browser/target.ts";
import { registerTarget } from "../internal.ts";

registerTarget(currentTarget(), mount);
