// The hydrate:svelte project's last setup file (L12, ADR-0095): registers svelte's hydrate adapter.
import { hydrate } from "@unframework.dev/target-svelte/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("svelte", hydrate);
