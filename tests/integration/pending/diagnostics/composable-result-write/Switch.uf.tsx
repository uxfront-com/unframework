// UF2036 composable-result-write: the component writes a ref its composable returns. The
// composable owns its state, and on React and Svelte the caller holds no ref to write: change
// it through a function the composable returns, `toggle()`.
import { useToggle } from "./useToggle.uf.ts";

export default function Switch() {
  const { on, toggle } = useToggle(false);

  function turnOn() {
    on.value = true;
  }

  return (
    <div class="switch">
      <button type="button" onClick={() => toggle()}>
        Toggle
      </button>
      <button type="button" onClick={turnOn}>
        {on.value ? "On" : "Off"}
      </button>
    </div>
  );
}
