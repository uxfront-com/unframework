// Vue's client render: the output compiled by @vitejs/plugin-vue and mounted by the toolchain's
// adapter in Chromium, as one component per suite (large static templates are stringified into
// `innerHTML`) and one per case (small ones are rendered through `patchProp`, which sets some
// attributes as DOM properties). Markup is never formatted, so there is one output to mount.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("vue", suites, mount);
