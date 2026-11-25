import { createState } from "./_unframework/createState";
import { queueHook } from "./_unframework/queueHook";
import { vSelectable } from "./vSelectable";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createEffect, omit, onCleanup, onSettled, untrack } from "solid-js";

interface User {
  name: string;
}

const hooks = "data-hooks";
const element = "data-element";

function vMark(getValue: () => string): (element: HTMLElement) => void {
  const hooks_1 = {
    mounted(el: HTMLElement, value: string) {
      el.setAttribute(hooks, value);
      el.setAttribute(element, "mounted");
      return el;
    },
    updated(el: HTMLElement, value: string) {
      const oldValue = "updated";
      el.setAttribute(hooks, `${oldValue} ${value}`);
    },
    unmounted() {},
  };
  let target: HTMLElement | undefined;
  let current = untrack(getValue);
  onSettled(() => {
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.mounted(element_1, current), "mounted");
  });
  createEffect(getValue, (next) => {
    if (Object.is(next, current)) return;
    current = next;
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.updated(element_1, next), "updated");
  });
  onCleanup(() => {
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.unmounted(), "unmounted");
  });
  return (element_1) => {
    target = element_1;
  };
}

export default function Profile(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [user, setUser] = createState<User | null>({ name: "Ada" });
  const [note, setNote] = createState("Hello");
  const [label, setLabel] = createState<string | number>("Lovelace");
  const [nick, setNick] = createState<string | undefined>("Al");
  const [track] = createState("Trail");
  const [cleanup] = createState<string | null>("Tidy");

  return (
    <section
      class={props.class ? `profile ${props.class}` : "profile"}
      aria-label="Profile"
      {...others}
    >
      <Show when={user()}>{(user) => <p ref={vMark(() => user().name)}>{user().name}</p>}</Show>
      <Show when={((label) => (typeof label === "string" ? { label } : undefined))(label())}>
        {(narrowed) => <b ref={vMark(() => narrowed().label)}>{narrowed().label}</b>}
      </Show>
      <Show when={nick()}>{(nick) => <i ref={vMark(() => nick())}>{nick()}</i>}</Show>
      <Show when={cleanup()}>
        {(cleanup) => <s ref={vMark(() => cleanup() + track())}>{cleanup()}</s>}
      </Show>
      <textarea
        aria-label="Note"
        value={note()}
        onInput={(event) => setNote(event.currentTarget.value)}
        ref={[textCaret, vMark(() => note()), vSelectable(() => true)]}
      />
      <button type="button" onClick={() => setUser(user() ? null : { name: "Grace" })}>
        Toggle
      </button>
      <button type="button" onClick={() => setLabel(1)}>
        Count
      </button>
      <button type="button" onClick={() => setNick(undefined)}>
        Forget
      </button>
    </section>
  );
}

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
}
