import { For, type JSX, createMemo, untrack } from "solid-js";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default function StepList(
  props: StepListProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ol
      class={props.class ? `step-list ${props.class}` : "step-list"}
      aria-label={props.title}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <KeyedFor each={props.steps} by={(step, index) => index}>
        {(step) => (
          <li data-step={step.index + 1}>
            Step {step.index + 1}: {step.value}
          </li>
        )}
      </KeyedFor>
    </ol>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
