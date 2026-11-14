// The hydrate:qwik project's last setup file (L12, ADR-0095): registers qwik's hydrate adapter.
import { hydrate } from "@unframework.dev/target-qwik/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("qwik", hydrate);
