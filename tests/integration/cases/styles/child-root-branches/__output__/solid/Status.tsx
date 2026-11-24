import { scopeAttributes } from "./_unframework/scopeAttributes";
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
