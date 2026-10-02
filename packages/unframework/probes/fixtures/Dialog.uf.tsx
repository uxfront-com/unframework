import {
  defineExpose,
  defineModel,
  defineSlots,
  useId,
  useTemplateRef,
  type JSX,
} from "unframework";

export interface DialogProps {
  label: string;
  modal?: boolean;
}

export default function Dialog({ label, modal = true }: DialogProps) {
  const open = defineModel<boolean>("open", { default: false });
  const slots = defineSlots<{ default?(): JSX.Element; title?(): JSX.Element }>();
  const panel = useTemplateRef<HTMLDivElement>();
  const titleId = useId();

  function focus() {
    panel.value?.focus();
  }
  defineExpose({ focus });

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal={modal}
      aria-labelledby={titleId}
      hidden={!open.value}
    >
      <h2 id={titleId}>{slots.title?.() ?? label}</h2>
      {slots.default?.()}
      <button type="button" onClick={() => (open.value = false)}>
        Close
      </button>
    </div>
  );
}
