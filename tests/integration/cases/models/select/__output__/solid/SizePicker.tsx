import { type JSX, createEffect, createSignal, onCleanup } from "solid-js";

export default function SizePicker(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal("m");

  return (
    <section aria-label="Size" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <label>
        Size{" "}
        <select
          onChange={(event) => setSize(event.currentTarget.value)}
          ref={(select) => selectOptions(select, size)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * Selects a `<select>`'s options that hold `value`, or a value of it for an array, and none
 * where none holds it: as the value changes, and as options come and go.
 */
function selectOptions(select: HTMLSelectElement, value: () => unknown): void {
  const choose = () => {
    const current = value();
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
  };
  createEffect(choose);
  const observer = new MutationObserver(choose);
  observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  onCleanup(() => observer.disconnect());
}
