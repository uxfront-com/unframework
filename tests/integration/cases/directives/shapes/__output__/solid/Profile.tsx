import { queueHook } from "./_unframework/queueHook";
import { vSelectable } from "./vSelectable";
import {
  type ComponentProps,
  type JSX,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
  untrack,
} from "solid-js";
import { isServer } from "solid-js/web";

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
  onMount(() => {
    const element_1 = target;
    if (element_1) queueHook(element_1, () => hooks_1.mounted(element_1, current), "mounted");
  });
  createEffect(() => {
    const next = getValue();
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
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [user, setUser] = createSignal<User | null>({ name: "Ada" });
  const [note, setNote] = createSignal("Hello");
  const [label, setLabel] = createSignal<string | number>("Lovelace");
  const [nick, setNick] = createSignal<string | undefined>("Al");
  const [track] = createSignal("Trail");
  const [cleanup] = createSignal<string | null>("Tidy");

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
        value={isServer ? undefined : note()}
        children={isServer ? note() : undefined}
        onInput={(event) => setNote(event.currentTarget.value)}
        ref={(element_1) => {
          textCaret(element_1);
          vMark(() => note())(element_1);
          vSelectable(() => true)(element_1);
        }}
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
