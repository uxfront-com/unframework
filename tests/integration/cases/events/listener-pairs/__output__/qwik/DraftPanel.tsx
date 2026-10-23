import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface DraftPanelEvents {
  onSave$?: QRL<(count: number) => void>;
  onStatus$?: QRL<(value: string) => void>;
  onClosed$?: QRL<(reason: string) => void>;
  onKey$?: QRL<(key: string) => void>;
}

export default component$<DraftPanelEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onSave$, onStatus$, onClosed$, onKey$, class: className, style, ...attributes }) => {
    // Functions that reference each other: a QRL captures what it reads when it is created, so each
    // reads the other from here once both exist.
    const functions = useConstant(() => ({}) as { onEscape: typeof onEscape });

    const open = useSignal(false);
    const status = useSignal("draft");
    const saves = useSignal(0);
    const log = useSignal<string[]>([]);
    const handle = useSignal<HTMLButtonElement>();
    const handleElement = useSignal<HTMLButtonElement | null>(null);

    const record = $((line: string) => {
      log.value = [...log.value, line];
    });

    const onKey = useConstant(() =>
      $(async (event: KeyboardEvent) => {
        await record(`key ${event.key}`);
        onKey$?.(event.key);
      }),
    );

    const close = $((reason: string) => {
      open.value = false;
      document.removeEventListener("keydown", functions.onEscape);
      onClosed$?.(reason);
    });

    const onEscape = useConstant(() => {
      const created = $(async (event: KeyboardEvent) => {
        if (event.key === "Escape") await close("escape");
      });
      functions.onEscape = created;
      return created;
    });

    const show = $(() => {
      open.value = true;
      document.addEventListener("keydown", onEscape);
    });

    const onHandleClick = useConstant(() =>
      $(async () => {
        await record("handle");
      }),
    );

    const save = $(() => {
      saves.value += 1;
      status.value = "saved";
      onSave$?.(saves.value);
    });

    const previousStatus = useSignal(() => status.value);
    useTask$(
      ({ track }) => {
        const value = track(status);
        if (Object.is(value, previousStatus.value)) return;
        previousStatus.value = value;
        onStatus$?.(value);
      },
      { deferUpdates: false },
    );

    useVisibleTask$(
      () => {
        handleElement.value = handle.value ?? null;
        handleElement.value?.addEventListener("click", onHandleClick);
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          document.removeEventListener("keydown", onEscape);
          document.removeEventListener("keydown", onKey);
          handleElement.value?.removeEventListener("click", onHandleClick);
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["draft-panel", className]}
        aria-label="Draft"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <button type="button" aria-expanded={open.value} onClick$={show}>
          Options
        </button>
        <>
          {open.value ? (
            <div class="options" role="group" aria-label="Draft options">
              <button type="button" onClick$={() => close("button")}>
                Close
              </button>
            </div>
          ) : null}
        </>
        <button type="button" onClick$={() => document.addEventListener("keydown", onKey)}>
          Listen
        </button>
        <button type="button" onClick$={() => document.removeEventListener("keydown", onKey)}>
          Stop listening
        </button>
        <button type="button" ref={handle}>
          Handle
        </button>
        <button type="button" onClick$={save}>
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
