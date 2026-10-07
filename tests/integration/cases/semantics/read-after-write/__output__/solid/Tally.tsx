import { createSignal } from "solid-js";

export interface TallyEvents {
  onTotal?: (value: number) => void;
  onSteps?: (values: number[]) => void;
  onLogged?: (entries: string[]) => void;
}

export default function Tally(props: TallyEvents) {
  const [count, setCount] = createSignal(0);
  const [trail, setTrail] = createSignal<string[]>([]);

  function addTwice() {
    setCount(count() + 1);
    setCount(count() + 1);
    props.onTotal?.(count());
  }

  function addFive() {
    setCount(count() + 5);
    props.onTotal?.(count());
  }

  function countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      setCount(count() + 1);
      seen.push(count());
    }
    props.onSteps?.(seen);
  }

  function addTen() {
    setCount(count() + 10);
  }

  function addTenAndReport() {
    addTen();
    props.onTotal?.(count());
  }

  function logCapture() {
    setTrail([...trail(), "capture"]);
  }

  function logBubble() {
    setTrail([...trail(), "bubble"]);
    props.onLogged?.(trail());
  }

  return (
    <section class="tally" aria-label="Tally">
      <p role="status">Count: {count()}</p>
      <button type="button" onClick={addTwice}>
        Add two
      </button>
      <button type="button" onClick={addFive}>
        Add five
      </button>
      <button type="button" onClick={countUp}>
        Count up three
      </button>
      <button type="button" onClick={addTenAndReport}>
        Add ten
      </button>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", logCapture, { capture: true })}
        onClick={logBubble}
      >
        Log the phases
      </button>
      <p>Phases: {trail().join(" then ")}</p>
    </section>
  );
}
