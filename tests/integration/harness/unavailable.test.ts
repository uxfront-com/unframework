// The stand-in for an ssr or browser project whose configuration could not be built (its
// toolchain or the unplugin did not load). It fails every case the project owes, at each of
// its layers, with the reason: a project that cannot start never looks green or goes missing.
import { recordLayer } from "@unframework/testing/node";
import type { LayerName } from "@unframework/testing/node";
import { describe, inject, it } from "vitest";

import { errorState, listCases } from "./cases.ts";
import "./context.ts";

const target = inject("target");
const harness = inject("ufHarness");
const { project, layers, message } = inject("ufUnavailable");
const browser = project.startsWith("browser:");

describe(`${project} (unavailable)`, () => {
  for (const info of listCases(harness.casesDir)) {
    // The cases this project would verify: the browser projects run the specs, ssr projects
    // every case with output.
    if (browser ? !info.spec : errorState(info, target) === true) continue;
    it(`${info.id} › ${target}`, ({ task }) => {
      for (const layer of layers as LayerName[]) {
        recordLayer(task, { case: info.id, target, quarantine: harness.quarantine }, layer, {
          status: "fail",
          message: `${project} could not start: ${message.split("\n")[0]}`,
        });
      }
      throw new Error(`${project} could not start:\n${message}`);
    });
  }
});
