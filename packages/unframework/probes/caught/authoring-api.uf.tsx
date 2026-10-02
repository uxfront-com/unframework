// What the types of the authoring API (plan §4.2) catch inside a component body.
import {
  computed,
  defineEmits,
  defineExpose,
  defineModel,
  defineOptions,
  defineSlots,
  inject,
  provide,
  ref,
  useTemplateRef,
  watch,
  type Element,
} from "unframework";

import { TabsKey } from "../fixtures/keys.ts";

export function Emits() {
  const emit = defineEmits<{ change: [value: number]; close: [] }>();
  // @ts-expect-error TS2345 unknown event name
  emit("chnage", 1);
  // @ts-expect-error TS2345 payload type comes from the named tuple
  emit("change", "1");
  // @ts-expect-error TS2554 `close` has no payload
  emit("close", 1);
  return <div />;
}

export function EmitsWithoutTypeArgument() {
  const emit = defineEmits();
  // @ts-expect-error TS2345 an un-parameterised defineEmits accepts no event (it defaults to never)
  emit("anything");
  return <div />;
}

export function PayloadsAreNamedTuples() {
  // @ts-expect-error TS2344 a payload is a tuple (`[value: string]`), never a bare type
  defineEmits<{ change: string }>();
  return <div />;
}

export function EmitReturnsVoid() {
  const emit = defineEmits<{ change: [value: number] }>();
  // @ts-expect-error TS2339 emit returns void: listeners may run asynchronously (Qwik, plan §4.5)
  emit("change", 1).then(() => {});
  return <div />;
}

export function ModelNeedsAName() {
  // @ts-expect-error TS2554 `defineModel()` without a name (plan §4.6); the compiler also reports it
  const value = defineModel<string>();
  return <div>{value.value}</div>;
}

export function ModelValueType() {
  const open = defineModel<boolean>("open", { default: false });
  // @ts-expect-error TS2322 the model is a boolean
  open.value = "yes";
  // @ts-expect-error TS2769 the default must match the model type (no overload matches)
  const size = defineModel<number>("size", { default: "md" });
  return <div>{size.value}</div>;
}

export function ModelWithoutADefaultMayBeUndefined() {
  const value = defineModel<number>("value");
  // @ts-expect-error TS18048 without `default` or `required: true`, a consumer may leave it unbound
  return <div>{value.value.toFixed()}</div>;
}

export function ComputedIsReadOnly() {
  const count = ref(0);
  const doubled = computed(() => count.value * 2);
  // @ts-expect-error TS2540 computed is read-only (plan §4.2)
  doubled.value = 4;
  // @ts-expect-error TS2322 ref(0) is a Ref<number>
  count.value = "1";
  return <div />;
}

export function WritableComputedIsNotSupported() {
  // @ts-expect-error TS2353 one form: computed(getter)
  const c = computed({ get: () => 1, set: (_v: number) => {} });
  return <div title={String(c.value)} />;
}

export function Slots() {
  const slots = defineSlots<{ default?(): Element; item?(p: { id: string }): Element }>();
  // @ts-expect-error TS2322 slot props are typed on the component side
  const rendered = slots.item?.({ id: 1 });
  // @ts-expect-error TS2339 undeclared slot
  const missing = slots.footer;
  return (
    <div>
      {rendered}
      {missing}
    </div>
  );
}

export function Options() {
  // @ts-expect-error TS2561 only static, known options (did you mean `inheritAttrs`?)
  defineOptions({ inheritAttr: false });
  // @ts-expect-error TS2322 `inheritAttrs` is a boolean
  defineOptions({ inheritAttrs: "no" });
  return <div />;
}

export function ExposeTakesAnObject() {
  // @ts-expect-error TS2345 the exposed API is an object: `defineExpose({ focus })`
  defineExpose(42);
  return <div />;
}

export function Context() {
  // @ts-expect-error TS2322 the value must match the key type
  provide(TabsKey, { active: 1 });
  const tabs = inject(TabsKey);
  // @ts-expect-error TS18048 inject without a fallback may be undefined
  tabs.select("a");
  // @ts-expect-error TS2345 keys are `InjectionKey<T>` symbols, never strings
  provide("tabs", 1);
  return <div />;
}

export function Watchers() {
  const text = ref("");
  const count = ref(0);
  // @ts-expect-error TS2551 the watched value is a string
  watch(text, (value) => value.toFixed());
  // @ts-expect-error TS18048 with `immediate`, the first run has no previous value
  watch(text, (_value, previous) => previous.length, { immediate: true });
  // @ts-expect-error TS2769 watch a ref, a computed or a getter: `count.value` is read once
  watch(count.value, () => {});
  return <div />;
}

export function TemplateRefs() {
  // @ts-expect-error TS2554 no string key (plan §4.2): JSX passes the ref object, `ref={input}`
  const keyed = useTemplateRef<HTMLInputElement>("input");
  const input = useTemplateRef<HTMLInputElement>();
  // @ts-expect-error TS18047 the element only exists once mounted
  const focus = () => input.value.focus();
  return (
    <>
      <input ref={keyed} />
      <input ref={input} onFocus={focus} />
    </>
  );
}

export function CallSignatureEmits() {
  // @ts-expect-error TS2344 one canonical form (P3): the named-tuple map, not Vue's call signatures
  defineEmits<{ (event: "change", value: number): void }>();
  return <div />;
}
