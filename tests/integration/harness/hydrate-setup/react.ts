// The hydrate:react project's last setup file (L12, ADR-0095): registers react's hydrate adapter.
import { hydrate } from "@unframework.dev/target-react/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("react", hydrate);
