import type { JSX } from "@solidjs/web";

export interface FilterPanelProps {
  heading: string;
  hint: string;
  category: string;
  expanded: boolean;
  inStockOnly: boolean;
  locked: boolean;
  mandatory: boolean;
  loading: boolean;
  invalid?: boolean;
  current?: "page" | "step";
}

export default function FilterPanel(
  props: FilterPanelProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `filter-panel ${props.class}` : "filter-panel"}
      aria-label={props.heading}
      data-category={props.category}
      data-layout="stacked"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button
        type="button"
        aria-expanded={enumeratedValue(props.expanded)}
        aria-describedby="filter-panel-hint"
      >
        Price filters
      </button>
      <p id="filter-panel-hint">{props.hint}</p>
      <details open={props.expanded}>
        <summary>Price range</summary>
        <label>
          Minimum price
          <input
            type="number"
            name="min-price"
            required={props.mandatory}
            disabled={props.locked}
            aria-invalid={enumeratedValue(props.invalid)}
          />
        </label>
      </details>
      <button
        type="button"
        aria-pressed={enumeratedValue(props.inStockOnly)}
        disabled={props.locked}
      >
        In stock only
      </button>
      <nav aria-label="Filter steps">
        <a href="#filters" aria-current={props.current}>
          Filters
        </a>
      </nav>
      <p role="status" aria-live="polite" aria-busy={enumeratedValue(props.loading)}>
        {props.loading ? "Loading results" : "Results ready"}
      </p>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
