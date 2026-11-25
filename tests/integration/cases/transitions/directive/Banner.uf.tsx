import "./Banner.css";
import { Transition, ref } from "@uxfront/unframework";

import { vMark } from "./mark.uf.ts";

// A banner whose element applies a directive, inside a transition that removes it.
export default function Banner() {
  const shown = ref(true);

  return (
    <section aria-label="News">
      <button type="button" onClick={() => (shown.value = false)}>
        Dismiss
      </button>
      <Transition name="fade">
        {shown.value && (
          <p class="banner" v-mark="banner">
            New releases are out.
          </p>
        )}
      </Transition>
    </section>
  );
}
