import { type JSX, Match, Switch } from "solid-js";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

export default function FilterSummary(
  props: FilterSummaryProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `filter-summary ${props.class}` : "filter-summary"}
      aria-label="Filters"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>Tags: {Array.isArray(props.tags) ? props.tags.join(", ") : props.tags}</p>
      <p>
        Limit:{" "}
        {typeof props.limit === "number" ? props.limit.toFixed(0) : props.limit.toLowerCase()}
      </p>
      <Switch>
        <Match when={props.result.ok ? { result: props.result } : undefined}>
          {(narrowed) => <p>Found {narrowed().result.match}</p>}
        </Match>
        <Match when={props.result.ok ? undefined : { result: props.result }}>
          {(narrowed) => <p>No match: {narrowed().result.error}</p>}
        </Match>
      </Switch>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
