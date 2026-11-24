import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useId,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface ConfirmDialogProps {
  title: string;
}

export interface ConfirmDialogEvents {
  onConfirm$?: QRL<() => void>;
  onClose$?: QRL<() => void>;
}

export default component$<
  ConfirmDialogProps &
    ConfirmDialogEvents &
    Omit<PropsOf<"div">, "title" | "onConfirm$" | "onClose$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, onConfirm$, onClose$, class: className, style, onKeyDown$, ...attributes }) => {
  const titleId = "uf-id-" + useId();
  const cancel = useSignal<HTMLButtonElement>();

  useVisibleTask$(
    () => {
      cancel.value?.focus();
    },
    { strategy: "document-ready" },
  );

  const onKeydown = $((event: KeyboardEvent) => {
    if (event.key === "Escape") onClose$?.();
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      class={["dialog", className]}
      onKeyDown$={[onKeydown, onKeyDown$]}
      style={style}
      {...attributes}
    >
      <h2 id={titleId}>{title}</h2>
      <button type="button" ref={cancel} onClick$={() => onClose$?.()}>
        Cancel
      </button>
      <button type="button" onClick$={() => onConfirm$?.()}>
        Delete
      </button>
    </div>
  );
});
