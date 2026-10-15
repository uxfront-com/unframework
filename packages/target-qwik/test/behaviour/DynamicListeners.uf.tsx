import { ref } from "unframework";

// A `<component is>` with listeners of its own (src/plan.ts groups them as an element's).
export default function DynamicListeners({ link }: { link: boolean }) {
  const count = ref(0);
  function bump() {
    count.value += 1;
  }
  return (
    <component
      is={link ? "a" : "button"}
      role="button"
      tabindex="0"
      onClick={bump}
      onKeydown={bump}
    >
      Count {count.value}
    </component>
  );
}
