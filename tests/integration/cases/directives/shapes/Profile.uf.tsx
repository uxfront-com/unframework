import { defineDirective, ref } from "@uxfront/unframework";

import { vSelectable } from "./select.uf.ts";

// Names the outputs' own wrappers use too, which the hooks read as the module's (ADR-0099).
const hooks = "data-hooks";
const element = "data-element";

const vMark = defineDirective<string>({
  mounted(el, value) {
    el.setAttribute(hooks, value);
    el.setAttribute(element, "mounted");
    return el;
  },
  updated(el, value) {
    const oldValue = "updated";
    el.setAttribute(hooks, `${oldValue} ${value}`);
  },
  unmounted(_el) {},
});

interface User {
  name: string;
}

export default function Profile() {
  const user = ref<User | null>({ name: "Ada" });
  const note = ref("Hello");
  const label = ref<string | number>("Lovelace");
  const nick = ref<string | undefined>("Al");

  return (
    <section class="profile" aria-label="Profile">
      {user.value ? <p v-mark={user.value.name}>{user.value.name}</p> : null}
      {typeof label.value === "string" ? <b v-mark={label.value}>{label.value}</b> : null}
      {nick.value ? <i v-mark={nick.value}>{nick.value}</i> : null}
      <textarea aria-label="Note" v-model={note.value} v-mark={note.value} v-selectable={true} />
      <button type="button" onClick={() => (user.value = user.value ? null : { name: "Grace" })}>
        Toggle
      </button>
      <button type="button" onClick={() => (label.value = 1)}>
        Count
      </button>
      <button type="button" onClick={() => (nick.value = undefined)}>
        Forget
      </button>
    </section>
  );
}
