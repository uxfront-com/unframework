// Svelte's client render: the output, formatted and not (only its script block differs: markup is
// never formatted), compiled by vite-plugin-svelte for the DOM (`<template>` clones) and mounted
// by the toolchain's adapter in Chromium with the suite's props.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("svelte", suites, mount);
