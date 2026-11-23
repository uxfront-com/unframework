// The hydrate:ember project's last setup file (L12, ADR-0095): registers ember's hydrate adapter.
import { hydrate } from "@unframework.dev/target-ember/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("ember", hydrate);
