// A framework import type-checks whenever the framework is installed, as Vue is here. Not caught by
// the types. Caught by: compiler (plan §4.6; the corpus case diagnostics/framework-import-rejected).
import { ref as vueRef } from "vue";

export function FrameworkImport() {
  const count = vueRef(0);
  return <output>{count.value}</output>;
}
