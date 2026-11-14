// The hydrate:angular project's last setup file (L12, ADR-0095): registers angular's hydrate adapter.
import { hydrate } from "@unframework.dev/target-angular/toolchain/hydrate";
import { registerHydrateAdapter } from "@unframework.dev/testing/harness";

registerHydrateAdapter("angular", hydrate);
