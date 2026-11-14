// The hydrate:vue project's last setup file (L12, ADR-0095): registers vue's hydrate adapter.
import { hydrate } from "@unframework.dev/target-vue/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("vue", hydrate);
