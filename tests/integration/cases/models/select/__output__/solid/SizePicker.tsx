import { type JSX, createEffect, createSignal } from "solid-js";

export default function SizePicker(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal("m");

  return (
    <section aria-label="Size" class={props.class} style={props.style}>
      <label>
        Size{" "}
        <select
          onChange={(event) => setSize(event.currentTarget.value)}
          ref={(select) =>
            createEffect(() => {
              if (select.value !== String(size())) select.selectedIndex = -1;
            })
          }
        >
          <option value="s" selected={size() === "s"}>
            Small
          </option>
          <option value="m" selected={size() === "m"}>
            Medium
          </option>
          <option value="l" selected={size() === "l"}>
            Large
          </option>
        </select>
      </label>
      <output>Chosen: {size()}</output>
      <button type="button" onClick={() => setSize("l")}>
        Largest
      </button>
    </section>
  );
}
