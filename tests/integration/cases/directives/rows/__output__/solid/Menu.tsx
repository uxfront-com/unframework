import Picker from "./Picker";
import { KeyedFor } from "./_unframework/KeyedFor";
import { vMark } from "./vMark";
import { vTrace } from "./vTrace";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export default function Menu(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [items, setItems] = createSignal<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  const [prefix, setPrefix] = createSignal("Open");
  const [focused, setFocused] = createSignal(0);

  return (
    <section class={props.class ? `menu ${props.class}` : "menu"} aria-label="Menu" {...others}>
      <ul aria-label="Items">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li data-name={item.value.id} ref={vTrace(() => item.value.label)}>
              {item.value.label}
              <Show
                when={item.value.note ? { item: item.value, note: item.value.note } : undefined}
              >
                {(narrowed) => (
                  <b data-name={`note-${narrowed().item.id}`} ref={vTrace(() => narrowed().note)}>
                    {narrowed().note}
                  </b>
                )}
              </Show>
            </li>
          )}
        </KeyedFor>
      </ul>
      <ul aria-label="Marked">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li
              data-name={`both-${item.value.id}`}
              ref={(element) => {
                vTrace(() => item.value.label)(element);
                vMark(() => item.value.id)(element);
              }}
            >
              {item.value.label}
            </li>
          )}
        </KeyedFor>
      </ul>
      <div class="focus">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <button
              type="button"
              data-name={`focus-${item.value.id}`}
              onFocusIn={() => setFocused(focused() + 1)}
              ref={vTrace(() => item.value.label)}
            >
              Focus {item.value.label}
            </button>
          )}
        </KeyedFor>
      </div>
      <output>{focused()}</output>
      <ul aria-label="Prefixed">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li
              data-name={`prefixed-${item.value.id}`}
              ref={vTrace(() => `${prefix()} ${item.value.label}`)}
            >
              {item.value.label}
            </li>
          )}
        </KeyedFor>
      </ul>
      <Picker
        option={({ option }) => (
          <span data-name={`option-${option.id}`} ref={vTrace(() => `${prefix()} ${option.label}`)}>
            {option.label}
          </span>
        )}
      />
      <button
        type="button"
        onClick={() =>
          setItems(
            items().map((item) =>
              item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
            ),
          )
        }
      >
        Rename first
      </button>
      <button type="button" onClick={() => setItems([...items()].reverse())}>
        Reverse
      </button>
      <button type="button" onClick={() => setItems(items().filter((item) => item.id !== "b"))}>
        Remove second
      </button>
      <button type="button" onClick={() => setItems([...items(), { id: "d", label: "Delta" }])}>
        Add item
      </button>
      <button type="button" onClick={() => setPrefix("Close")}>
        Change prefix
      </button>
    </section>
  );
}
