import Choice from "./Choice";
import List from "./List";
import Wrapper from "./Wrapper";
import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import { vTrace } from "./vTrace";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [label, setLabel] = createState("first");
  let note: HTMLParagraphElement | null = null;
  const [noted, setNoted] = createState("");

  return (
    <section class={props.class ? `page ${props.class}` : "page"} aria-label="Page" {...others}>
      <Wrapper
        row={
          <span data-name="row" ref={vTrace(() => label())}>
            Row
          </span>
        }
      />
      <Choice
        body={
          <em data-name="body" ref={vTrace(() => label())}>
            Body
          </em>
        }
      />
      <List
        items={["a", "b"]}
        item={({ item }) => (
          <strong data-name="item" ref={vTrace(() => label())}>
            {item}
          </strong>
        )}
      />
      <p
        ref={[
          clearedRef(
            (element) => {
              note = element;
            },
            () => {
              note = null;
            },
          ),
          vTrace(() => label()),
        ]}
        data-name="note"
      >
        Note
      </p>
      <output>{noted()}</output>
      <button type="button" onClick={() => setNoted(note?.getAttribute("data-name") ?? "")}>
        Check
      </button>
      <button type="button" onClick={() => setLabel("second")}>
        Rename
      </button>
    </section>
  );
}
