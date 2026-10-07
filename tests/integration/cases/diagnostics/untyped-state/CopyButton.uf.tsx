// UF2021 untyped-state: the setup `let` has neither a type nor an initial value, so the outputs
// that declare it (React's `useRef`, Angular's field) cannot type it; annotate it,
// `let timer: ReturnType<typeof setTimeout> | undefined`.
import { ref } from "unframework";

export default function CopyButton() {
  const copied = ref(false);
  let timer;

  function copy() {
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  }

  return (
    <button type="button" class="copy-button" onClick={copy}>
      {copied.value ? "Copied" : "Copy the link"}
    </button>
  );
}
