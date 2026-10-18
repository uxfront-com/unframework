import { ref } from "unframework";

// A `<component is>` with listeners of its own and a child with one: src/index.ts prints one
// tag per candidate, each with every listener (src/plan.ts groups the tag's as an element's).
export default function DynamicListeners({ boxed }: { boxed: boolean }) {
  const count = ref(0);
  function bump() {
    count.value += 1;
  }
  return (
    <component is={boxed ? "section" : "div"} role="group" aria-label="Box" onFocusin={bump}>
      <button type="button" onClick={() => (count.value += 10)}>
        Add {count.value}
      </button>
    </component>
  );
}
