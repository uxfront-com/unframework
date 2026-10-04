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

export default function FilterPanel(props: FilterPanelProps) {
  return (
    <section
      class="filter-panel"
      aria-label={props.heading}
      data-category={props.category}
      data-layout="stacked"
    >
      <button type="button" aria-expanded={props.expanded} aria-describedby="filter-panel-hint">
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
            aria-invalid={props.invalid}
          />
        </label>
      </details>
      <button type="button" aria-pressed={props.inStockOnly} disabled={props.locked}>
        In stock only
      </button>
      <nav aria-label="Filter steps">
        <a href="#filters" aria-current={props.current}>
          Filters
        </a>
      </nav>
      <p role="status" aria-live="polite" aria-busy={props.loading}>
        {props.loading ? "Loading results" : "Results ready"}
      </p>
    </section>
  );
}
