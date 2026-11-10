import { useToggle } from "./useToggle.uf.ts";

export default function Disclosure() {
  const { on, toggle, close } = useToggle(false);

  return (
    <section class="disclosure" aria-label="Shipping">
      <button type="button" aria-expanded={on.value} onClick={() => toggle()}>
        Shipping details
      </button>
      {on.value && (
        <div class="panel">
          <p>Orders ship within two days.</p>
          <button type="button" onClick={() => close()}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}
