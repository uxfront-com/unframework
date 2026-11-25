import Picker from "./Picker.uf.tsx";
import { vTrace } from "./trace.uf.ts";

// A directive on each element a scoped fill renders, whose value reads the fill's props
// (ADR-0108): when the child passes one row new props, that row's element keeps its directive
// and runs `updated` with its new value.
export default function Page() {
  return (
    <section class="page" aria-label="Page">
      <Picker>
        {{
          option: ({ option }) => (
            <span data-name={`option-${option.id}`} v-trace={option.label}>
              {option.label}
            </span>
          ),
        }}
      </Picker>
    </section>
  );
}
