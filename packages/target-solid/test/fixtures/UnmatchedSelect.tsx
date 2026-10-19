import { type JSX, createEffect, createSignal } from "solid-js";

export default function UnmatchedSelect(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal("xl");

  return (
    <form class={props.class} style={props.style}>
      <select
        aria-label="Size"
        onChange={(event) => setSize(event.currentTarget.value)}
        ref={(select) =>
          createEffect(() => {
            if (select.value !== String(size())) select.selectedIndex = -1;
          })
        }
      >
        <option value="s" selected={size() === "s"}>
          S
        </option>
        <option value="m" selected={size() === "m"}>
          M
        </option>
      </select>
      <button type="button" onClick={() => setSize("m")}>
        M
      </button>
      <button type="button" onClick={() => setSize("xs")}>
        XS
      </button>
    </form>
  );
}
