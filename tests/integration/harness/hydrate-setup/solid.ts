// The hydrate:solid project's last setup file (L12, ADR-0095): registers solid's hydrate adapter.
import { hydrate } from "@unframework.dev/target-solid/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("solid", hydrate);
