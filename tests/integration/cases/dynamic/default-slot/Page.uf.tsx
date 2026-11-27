import { ref } from "@uxfront/unframework";

import Action from "./Action.uf.tsx";

export default function Page() {
  const linked = ref(true);
  return (
    <section class="page">
      <Action href="#docs" label="Docs">
        Read the docs
      </Action>
      <Action label="Save">Save the draft</Action>
      <Action href="#home" label="Home" />
      <Action label="Close" />
      <Action href={linked.value ? "#more" : undefined} label="More">
        {{
          default: () => <>Learn more</>,
          icon: () => <i aria-hidden="true">+</i>,
        }}
      </Action>
      <button type="button" onClick={() => (linked.value = !linked.value)}>
        Toggle
      </button>
    </section>
  );
}
