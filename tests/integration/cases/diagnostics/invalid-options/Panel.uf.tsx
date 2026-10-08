// UF2031 invalid-options: `defineOptions` takes a static `{ inheritAttrs: false }`; `name` is
// Vue's, which the other targets have no counterpart for.
import { defineOptions } from "unframework";

export default function Panel() {
  defineOptions({ name: "AppPanel" });
  return <section class="panel">Panel</section>;
}
