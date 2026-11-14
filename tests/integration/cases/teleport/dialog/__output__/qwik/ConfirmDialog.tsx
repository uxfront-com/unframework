import {
  $,
  type CSSProperties,
  type ClassList,
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
  ConfirmDialogProps & ConfirmDialogEvents & { class?: ClassList; style?: CSSProperties }
>(({ title, onConfirm$, onClose$, class: className, style, ...attributes }) => {
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
      onKeyDown$={onKeydown}
      {...scopeAttributes(attributes)}
      style={style}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
