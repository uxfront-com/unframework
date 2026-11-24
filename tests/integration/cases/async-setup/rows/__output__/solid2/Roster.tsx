import Member from "./Member";
import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function Roster(
  props: { ids: string[] } & Omit<ComponentProps<"section">, "ids" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "ids", "class");

  const [lead, setLead] = createState(true);
  const [guest, setGuest] = createState(false);

  return (
    <section
      class={props.class ? `roster ${props.class}` : "roster"}
      aria-label="Roster"
      {...others}
    >
      <button type="button" onClick={() => setLead(!lead())}>
        Switch lead
      </button>
      <button type="button" onClick={() => setGuest(!guest())}>
        Toggle guest
      </button>
      <ul>
        <KeyedFor each={props.ids} by={(id) => id}>
          {(id) => <Member id={id.value} />}
        </KeyedFor>
        <Show when={lead()} fallback={<Member id="linus" />}>
          <Member id="ada" />
        </Show>
        <Show when={guest()}>
          <Member id="hopper" />
        </Show>
      </ul>
    </section>
  );
}
