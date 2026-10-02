// Svelte's client render: the output compiled by vite-plugin-svelte for the DOM (`<template>`
// clones) and mounted by the toolchain's adapter in Chromium. Markup is never formatted, so
// there is one output to mount.
import { describeClientParity } from "../../codegen/test/render-parity-client.ts";
import { suites } from "../../codegen/test/render-parity-manifest.ts";
import { mount } from "../src/toolchain/client.ts";

describeClientParity("svelte", suites, mount);
