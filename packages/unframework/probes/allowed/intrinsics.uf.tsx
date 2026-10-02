// Legitimate element code (plan §4.3). Nothing here may error.
import { ref, useTemplateRef } from "unframework";

import Button from "../fixtures/Button.uf.tsx";
import Counter from "../fixtures/Counter.uf.tsx";

export function Elements({ href, active }: { href?: string; active: boolean }) {
  const text = ref("");
  const amount = ref(0);
  const checked = ref<string[]>([]);
  const picked = ref("a");
  const anyElement = useTemplateRef<HTMLElement>();
  const untyped = useTemplateRef();
  const attributes = { id: "spread", title: "Spread", "data-kind": "spread" };

  return (
    <>
      <div class="a" />
      <div class={["a", active && "b", { c: active }]} />
      <div class={{ active, inactive: !active }} />
      <div style="color: red" />
      <div style={{ color: "red", "--gap": 4, marginTop: 2 }} />
      <div {...attributes} class="after-spread" />
      <label for="x" tabindex={0} aria-hidden="true" aria-expanded={active} data-anything="1" />
      <input
        id="x"
        ref={anyElement}
        v-model={text.value}
        onInput={(event) => console.log(event.data)}
      />
      <input disabled />
      <input type="number" v-model_number={amount.value} v-model_lazy={amount.value} />
      <input type="checkbox" value="a" v-model={checked.value} />
      <input type="radio" value="a" v-model={picked.value} />
      <input type="radio" value="b" v-model={picked.value} />
      <textarea
        v-model_trim={text.value}
        onKeydown={(event) => event.key === "Enter" && event.preventDefault()}
      />
      <button
        type="button"
        ref={untyped}
        onClick={(event) => event.currentTarget}
        onClickCapture={() => {}}
        onClickOnce={() => {}}
        onClickPassive={() => {}}
        onKeydownCapture={(event) => event.key}
      >
        +{amount.value}
      </button>
      <button type="button" onClick={() => amount.value++}>
        Increment
      </button>
      <svg viewBox="0 0 10 10">
        <path d="M0 0L10 10" stroke-width={2} />
      </svg>
      <my-element some-prop="x" anyProp={1} class="c" />
      <component is={href ? "a" : "button"} href={href} class="link">
        Go
      </component>
      <component is={Counter} initial={1} />
      <component is={active ? Counter : Button} />
      {[1, 2].map((n) => (
        <span key={n}>{n}</span>
      ))}
      {active && <span>Active</span>}
      {active ? <span>Yes</span> : null}
      {active ? <span>Active</span> : href ? <a href={href}>Link</a> : <span>Neither</span>}
      {123n}
    </>
  );
}

export function ReturnsNullBranch({ show }: { show: boolean }) {
  return show ? <p>Shown</p> : null;
}

export function UsesNullableComponent() {
  return <ReturnsNullBranch show />;
}
