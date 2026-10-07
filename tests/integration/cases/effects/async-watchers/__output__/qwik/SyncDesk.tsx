import { $, type QRL, component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

export interface SyncDeskEvents {
  onChecked$?: QRL<(email: string) => void>;
  onSummary$?: QRL<(text: string) => void>;
  onFocused$?: QRL<(name: string) => void>;
  onProgress$?: QRL<(step: string, owner: string) => void>;
  onSaveState$?: QRL<(error: string, name: string) => void>;
  onSavedName$?: QRL<(name: string) => void>;
  onImportState$?: QRL<(status: string, count: number) => void>;
  onSettled$?: QRL<(note: string) => void>;
  onSending$?: QRL<(busy: boolean, outcome: string) => void>;
  onSent$?: QRL<(count: number) => void>;
  onClamped$?: QRL<(level: number) => void>;
}

async function validate(value: string): Promise<boolean> {
  return value.includes("@");
}

export default component$<SyncDeskProps & SyncDeskEvents>(
  ({
    files,
    onChecked$,
    onSummary$,
    onFocused$,
    onProgress$,
    onSaveState$,
    onSavedName$,
    onImportState$,
    onSettled$,
    onSending$,
    onSent$,
    onClamped$,
  }) => {
    const waiting = useSignal<Waiting[]>([]);

    const ask = $((): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        waiting.value = [...waiting.value, { resolve, reject }];
      });
    });

    const answer = $((text: string) => {
      const [first, ...rest] = waiting.value;
      waiting.value = rest;
      first?.resolve(text);
    });

    const fail = $(() => {
      const [first, ...rest] = waiting.value;
      waiting.value = rest;
      first?.reject(new Error("offline"));
    });

    const email = useSignal("ada@example.com");
    const checking = useSignal(false);
    const valid = useSignal(true);
    const confirm = useSignal<HTMLButtonElement>();

    const previousEmail = useSignal(() => email.value);
    useTask$(
      ({ track }) => {
        const value = track(email);
        if (Object.is(value, previousEmail.value)) return;
        previousEmail.value = value;
        void (async () => {
          checking.value = true;
          const ok = await validate(value);
          checking.value = false;
          valid.value = ok;
        })();
      },
      { deferUpdates: false },
    );

    const previousEmail_1 = useSignal(() => email.value);
    useVisibleTask$(
      ({ track }) => {
        const value = track(email);
        if (Object.is(value, previousEmail_1.value)) return;
        previousEmail_1.value = value;
        onChecked$?.(value);
      },
      { strategy: "document-ready" },
    );

    const previousEffect = useSignal<[typeof email.value, typeof valid.value]>();
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof email.value, typeof valid.value] = [track(email), track(valid)];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        onSummary$?.(`${email.value} is ${valid.value ? "valid" : "invalid"}`);
      },
      { strategy: "document-ready" },
    );

    const suggest = $(async () => {
      email.value = "ada@lovelace.dev";
      await nextTick();
      confirm.value?.focus();
      onFocused$?.(document.activeElement?.textContent ?? "none");
    });

    const step = useSignal("idle");
    const owner = useSignal("nobody");
    const editor = useSignal("nobody");

    const previousValues = useSignal<[typeof step.value, typeof owner.value]>(() => [
      step.value,
      owner.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof step.value, typeof owner.value] = [track(step), track(owner)];
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [current, who] = values;
        onProgress$?.(current, who);
      },
      { deferUpdates: false },
    );

    const load = $(async () => {
      step.value = "owner";
      owner.value = await ask();
      step.value = "editor";
      editor.value = await ask();
      step.value = "done";
    });

    const name = useSignal("");
    const error = useSignal("");
    const saving = useSignal("");

    const previousValues_1 = useSignal<[typeof error.value, typeof saving.value]>(() => [
      error.value,
      saving.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof error.value, typeof saving.value] = [track(error), track(saving)];
        if (values.every((item, index) => Object.is(item, previousValues_1.value[index]))) return;
        previousValues_1.value = values;
        const [message, current] = values;
        onSaveState$?.(message, current);
      },
      { deferUpdates: false },
    );

    const persist = $(async (value: string) => {
      saving.value = value;
      await ask();
      saving.value = "";
    });

    const save = $(async () => {
      error.value = "";
      const payload = name.value.trim();
      if (!payload) {
        error.value = "Name required";
        return;
      }
      await persist(payload);
      onSavedName$?.(payload);
    });

    const status = useSignal("idle");
    const imported = useSignal(0);

    const previousValues_2 = useSignal<[typeof status.value, typeof imported.value]>(() => [
      status.value,
      imported.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof status.value, typeof imported.value] = [
          track(status),
          track(imported),
        ];
        if (values.every((item, index) => Object.is(item, previousValues_2.value[index]))) return;
        previousValues_2.value = values;
        const [text, count] = values;
        onImportState$?.(text, count);
      },
      { deferUpdates: false },
    );

    const importAll = $(async () => {
      imported.value = 0;
      status.value = "starting";
      for (const file of files) {
        status.value = `importing ${file}`;
        await ask();
        imported.value += 1;
      }
      status.value = "done";
    });

    const note = useSignal("idle");

    const refresh = $(() => {
      note.value = "refreshing";
      void ask()
        .then((text) => {
          note.value = `refreshed by ${text}`;
        })
        .finally(() => {
          onSettled$?.(note.value);
        });
    });

    const prefetch = $(async () => {
      const pending = ask();
      note.value = "waiting";
      const text = await pending;
      note.value = `prefetched by ${text}`;
    });

    const sendBusy = useSignal(false);
    const outcome = useSignal("");
    const total = useSignal(0);

    const previousValues_3 = useSignal<[typeof sendBusy.value, typeof outcome.value]>(() => [
      sendBusy.value,
      outcome.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof sendBusy.value, typeof outcome.value] = [
          track(sendBusy),
          track(outcome),
        ];
        if (values.every((item, index) => Object.is(item, previousValues_3.value[index]))) return;
        previousValues_3.value = values;
        const [sendingNow, text] = values;
        onSending$?.(sendingNow, text);
      },
      { deferUpdates: false },
    );

    const send = $(async () => {
      sendBusy.value = true;
      outcome.value = "";
      try {
        const reply = await ask();
        if (reply === "") {
          outcome.value = "Declined";
          sendBusy.value = false;
          return;
        }
        total.value += 1;
      } catch (failure) {
        outcome.value = failure instanceof Error ? failure.message : "Failed";
        sendBusy.value = false;
        return;
      }
      sendBusy.value = false;
      outcome.value = `Sent ${total.value}`;
      onSent$?.(total.value);
    });

    const volume = useSignal(4);
    const level = useSignal(4);

    const previousVolume = useSignal(() => volume.value);
    useTask$(
      ({ track }) => {
        const next = track(volume);
        if (Object.is(next, previousVolume.value)) return;
        previousVolume.value = next;
        let value: number = next * 2;
        if (value > 10) value = 10;
        level.value = value;
        onClamped$?.(value);
      },
      { deferUpdates: false },
    );

    return (
      <section class="sync-desk" aria-label="Sync desk">
        <button type="button" onClick$={suggest}>
          Suggest
        </button>
        <button type="button" ref={confirm}>
          Use this email
        </button>
        <p>
          {email.value}: {checking.value ? "checking" : valid.value ? "valid" : "invalid"}
        </p>
        <button type="button" onClick$={load}>
          Load
        </button>
        <p>
          Step: {step.value}, owner {owner.value}, editor {editor.value}
        </p>
        <label>
          Name
          <input
            name="name"
            onInput$={(_, element) => (name.value = (element as HTMLInputElement).value)}
          />
        </label>
        <button type="button" onClick$={save}>
          Save
        </button>
        <p>{saving.value === "" ? error.value || "Not saving" : `Saving ${saving.value}`}</p>
        <button type="button" onClick$={importAll}>
          Import
        </button>
        <p>
          Import: {status.value}, {imported.value} imported
        </p>
        <button type="button" onClick$={refresh}>
          Refresh
        </button>
        <button type="button" onClick$={prefetch}>
          Prefetch
        </button>
        <p>Note: {note.value}</p>
        <button type="button" onClick$={send}>
          Send
        </button>
        <p>
          Send: {sendBusy.value ? "sending" : outcome.value === "" ? "not sent" : outcome.value}
        </p>
        <button type="button" onClick$={() => (volume.value += 3)}>
          Louder
        </button>
        <p>Level: {level.value}</p>
        <div role="group" aria-label="Server">
          <button type="button" onClick$={() => answer("Ada")}>
            Reply
          </button>
          <button type="button" onClick$={() => answer("")}>
            Decline
          </button>
          <button type="button" onClick$={fail}>
            Fail
          </button>
        </div>
      </section>
    );
  },
);

/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
