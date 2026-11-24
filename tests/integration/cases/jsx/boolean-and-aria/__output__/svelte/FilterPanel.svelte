<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
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
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    | "heading"
    | "hint"
    | "category"
    | "expanded"
    | "inStockOnly"
    | "locked"
    | "mandatory"
    | "loading"
    | "invalid"
    | "current"
    | "children"
    | "class"
    | "style"
    | "ref"
  > &
    FilterPanelProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
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
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["filter-panel", className]}
  aria-label={heading}
  data-category={category}
  data-layout="stacked"
  {style}
  bind:this={ref}
  {...attributes}
>
  <button
    type="button"
    aria-expanded={expanded}
    aria-describedby="filter-panel-hint"
  >Price filters</button
  ><p id="filter-panel-hint">{hint}</p
  ><details open={expanded}>
    <summary>Price range</summary
    ><label>Minimum price<input
      type="number"
      name="min-price"
      required={mandatory}
      disabled={locked}
      aria-invalid={invalid}
    /></label>
  </details
  ><button type="button" aria-pressed={inStockOnly} disabled={locked}>In stock only</button
  ><nav aria-label="Filter steps">
    <a href="#filters" aria-current={current}>Filters</a>
  </nav
  ><p
    role="status"
    aria-live="polite"
    aria-busy={loading}
  >{loading ? "Loading results" : "Results ready"}</p>
</section>
