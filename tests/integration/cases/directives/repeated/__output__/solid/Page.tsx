import Choice from "./Choice";
import List from "./List";
import Wrapper from "./Wrapper";
import { vTrace } from "./vTrace";
import { type ComponentProps, type JSX, createSignal, onCleanup, splitProps } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [label, setLabel] = createSignal("first");
  let note: HTMLParagraphElement | null = null;
  const [noted, setNoted] = createSignal("");

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
        ref={(element) => {
          note = element;
          onCleanup(() => {
            note = null;
          });
          vTrace(() => label())(element);
        }}
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
