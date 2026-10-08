import { defineEmits, onMounted, onUnmounted, ref, useTemplateRef, watch } from "unframework";

export default function DraftPanel() {
  const emit = defineEmits<{
    save: [count: number];
    status: [value: string];
    closed: [reason: string];
    key: [key: string];
  }>();

  const open = ref(false);
  const status = ref("draft");
  const saves = ref(0);
  const log = ref<string[]>([]);
  const handle = useTemplateRef<HTMLButtonElement>();
  let handleElement: HTMLButtonElement | null = null;

  function record(line: string) {
    log.value = [...log.value, line];
  }

  function onKey(event: KeyboardEvent) {
    record(`key ${event.key}`);
    emit("key", event.key);
  }

  function close(reason: string) {
    open.value = false;
    document.removeEventListener("keydown", onEscape);
    emit("closed", reason);
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") close("escape");
  }

  function show() {
    open.value = true;
    document.addEventListener("keydown", onEscape);
  }

  function onHandleClick() {
    record("handle");
  }

  function save() {
    saves.value += 1;
    status.value = "saved";
    emit("save", saves.value);
  }

  function stop() {
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("keydown", onKey);
    handleElement?.removeEventListener("click", onHandleClick);
  }

  watch(status, (value) => {
    emit("status", value);
  });

  onMounted(() => {
    handleElement = handle.value;
    handleElement?.addEventListener("click", onHandleClick);
  });

  onUnmounted(() => stop());

  return (
    <section class="draft-panel" aria-label="Draft">
      <button type="button" aria-expanded={open.value} onClick={show}>
        Options
      </button>
      {open.value ? (
        <div class="options" role="group" aria-label="Draft options">
          <button type="button" onClick={() => close("button")}>
            Close
          </button>
        </div>
      ) : null}
      <button type="button" onClick={() => document.addEventListener("keydown", onKey)}>
        Listen
      </button>
      <button type="button" onClick={() => document.removeEventListener("keydown", onKey)}>
        Stop listening
      </button>
      <button type="button" ref={handle}>
        Handle
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p role="status">
        {open.value ? "Options open" : "Options closed"}, {status.value}
      </p>
      <ol aria-label="Log">
        {log.value.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
