// Vue's client render: the output, formatted and not (only its script block differs: markup is
// never formatted), compiled by @vitejs/plugin-vue and mounted by the toolchain's adapter in
// Chromium with the suite's props, as one component per suite (large static templates are
// stringified into `innerHTML`) and one per case (small ones are rendered through `patchProp`,
// which sets some attributes as DOM properties).
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("vue", suites, mount);
