// The hydrate:solid2 project's last setup file (L12, ADR-0095): registers Solid 2's hydrate
// adapter, which throws as it loads if the project resolved Solid 1 (ADR-0102).
import { hydrate } from "@unframework.dev/target-solid2/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("solid2", hydrate);
