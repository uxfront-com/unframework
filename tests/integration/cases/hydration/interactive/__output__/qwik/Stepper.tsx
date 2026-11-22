import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange$?: QRL<(value: number) => void>;
}

export default component$<
  StepperProps &
    StepperEvents &
    Omit<PropsOf<"div">, "start" | "onChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ start = 0, onChange$, class: className, style, ...attributes }) => {
  const count = useSignal(start);

  const add = $(() => {
    count.value += 1;
    onChange$?.(count.value);
  });

  return (
    <div class={["stepper", className]} style={style} {...attributes}>
      <output>{count.value}</output>
      <button type="button" onClick$={add}>
        Add one
      </button>
    </div>
  );
});
