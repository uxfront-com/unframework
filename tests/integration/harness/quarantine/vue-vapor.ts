// The Vue Vapor quarantine (ADR-0057, ADR-0112): the `vue-vapor` option set's known failures, each
// with its reason and issue. Only entries whose target is "vue-vapor" belong here, so each target
// lane edits its own file. An entry is allowed only for a failure Vue 3.6's release candidate
// causes, and links the vuejs/core issue that shows it without Unframework.
import type { QuarantineEntry } from "@unframework.dev/testing/node";

export const QUARANTINE: readonly QuarantineEntry[] = [];
