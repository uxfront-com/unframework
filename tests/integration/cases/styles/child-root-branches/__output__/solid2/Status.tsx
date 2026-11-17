import { Show } from "solid-js";

export default function Status(props: { busy: boolean; text: string }) {
  return (
    <>
      <Show
        when={props.busy}
        fallback={
          <button type="button" class="badge" {...scopeAttributes(props)}>
            {props.text}
          </button>
        }
      >
        <span class="badge" role="status" {...scopeAttributes(props)}>
          Saving
        </span>
      </Show>
    </>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
