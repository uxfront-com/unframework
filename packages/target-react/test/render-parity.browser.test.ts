// React's client render: the output, formatted and not, transformed by @vitejs/plugin-react (oxc)
// and mounted with `createRoot` by the toolchain's adapter in Chromium. React's client takes
// paths its server renderer does not (a `defaultValue` it ignores on a submit button), so
// test/render-parity.test.ts cannot speak for it.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("react", suites, mount);
