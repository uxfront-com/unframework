// The hydrate:vue-vapor project's last setup file (L12, ADR-0095, ADR-0112): registers the Vapor
// hydrate adapter, which throws as it loads if the project resolved a Vue older than 3.6.
import { hydrate } from "@unframework.dev/target-vue/toolchain/vapor/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("vue-vapor", hydrate);
