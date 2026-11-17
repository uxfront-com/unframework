// Solid 2's client render: the output, formatted and not, compiled by @solidjs/vite-plugin for the DOM
// (`<template>` clones and `setAttribute`) and mounted by the toolchain's adapter in Chromium
// with the suite's props.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("solid2", suites, mount);
