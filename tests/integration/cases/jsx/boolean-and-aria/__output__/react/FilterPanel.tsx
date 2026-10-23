import type { CSSProperties } from "react";

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

export interface FilterPanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function FilterPanel({
  heading,
  hint,
  category,
  expanded,
  inStockOnly,
  locked,
  mandatory,
  loading,
  invalid,
  current,
  className,
  style,
  ...attributes
}: FilterPanelProps & FilterPanelAttributes) {
  return (
    <section
      className={cx("filter-panel", className)}
      aria-label={heading}
      data-category={category}
      data-layout="stacked"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" aria-expanded={expanded} aria-describedby="filter-panel-hint">
        Price filters
      </button>
      <p id="filter-panel-hint">{hint}</p>
      <details open={expanded}>
        <summary>Price range</summary>
        <label>
          Minimum price
          <input
            type="number"
            name="min-price"
            required={mandatory}
            disabled={locked}
            aria-invalid={invalid}
          />
        </label>
      </details>
      <button type="button" aria-pressed={inStockOnly} disabled={locked}>
        In stock only
      </button>
      <nav aria-label="Filter steps">
        <a href="#filters" aria-current={current}>
          Filters
        </a>
      </nav>
      <p role="status" aria-live="polite" aria-busy={loading}>
        {loading ? "Loading results" : "Results ready"}
      </p>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
