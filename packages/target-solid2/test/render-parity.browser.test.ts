// Solid's client render: the output, formatted and not, compiled by vite-plugin-solid for the DOM
// (`<template>` clones and `setAttribute`) and mounted by the toolchain's adapter in Chromium
// with the suite's props.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("solid", suites, mount);
