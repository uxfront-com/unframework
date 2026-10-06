// Qwik's client render: the output, formatted and not, compiled by the optimizer in Vite and
// rendered on the client (no SSR, no resumption) by the toolchain's adapter in Chromium with the
// suite's props.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("qwik", suites, mount);
