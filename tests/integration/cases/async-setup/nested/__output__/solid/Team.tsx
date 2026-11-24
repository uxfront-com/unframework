import Lead from "./Lead";
import Member from "./Member";
import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, onCleanup, splitProps } from "solid-js";

export default function Team(
  props: { ids: string[] } & Omit<ComponentProps<"section">, "ids" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["ids", "class"]);

  let first: { reset(): void } | null = null;

  return (
    <section class={props.class ? `team ${props.class}` : "team"} aria-label="Team" {...others}>
      <h2>Team</h2>
      <button type="button" onClick={() => first?.reset()}>
        Reset
      </button>
      <Member
        ref={(api) => {
          first = api;
          onCleanup(() => {
            first = null;
          });
        }}
        id="ada"
      />
      <ul>
        <KeyedFor each={props.ids} by={(id) => id}>
          {(id) => (
            <li>
              <Member id={id.value} />
            </li>
          )}
        </KeyedFor>
      </ul>
      <Lead class="lead" id="hopper" />
    </section>
  );
}
