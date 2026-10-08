import { defineEmits, nextTick, ref, useTemplateRef, watch, watchEffect } from "unframework";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

export default function SyncDesk({ files }: SyncDeskProps) {
  const emit = defineEmits<{
    checked: [email: string];
    summary: [text: string];
    focused: [name: string];
    progress: [step: string, owner: string];
    saveState: [error: string, name: string];
    savedName: [name: string];
    importState: [status: string, count: number];
    settled: [note: string];
    sending: [busy: boolean, outcome: string];
    sent: [count: number];
    clamped: [level: number];
  }>();

  let waiting: Waiting[] = [];

  function ask(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      waiting = [...waiting, { resolve, reject }];
    });
  }

  function answer(text: string) {
    const [first, ...rest] = waiting;
    waiting = rest;
    first?.resolve(text);
  }

  function fail() {
    const [first, ...rest] = waiting;
    waiting = rest;
    first?.reject(new Error("offline"));
  }

  // A pre watcher whose flag goes up and down around an await that resolves at once, beside a
  // post watcher, a watchEffect and a handler that awaits nextTick().
  const email = ref("ada@example.com");
  const checking = ref(false);
  const valid = ref(true);
  const confirm = useTemplateRef<HTMLButtonElement>();

  async function validate(value: string): Promise<boolean> {
    return value.includes("@");
  }

  watch(email, async (value) => {
    checking.value = true;
    const ok = await validate(value);
    checking.value = false;
    valid.value = ok;
  });

  watch(
    email,
    (value) => {
      emit("checked", value);
    },
    { flush: "post" },
  );

  watchEffect(() => {
    emit("summary", `${email.value} is ${valid.value ? "valid" : "invalid"}`);
  });

  async function suggest() {
    email.value = "ada@lovelace.dev";
    await nextTick();
    confirm.value?.focus();
    emit("focused", document.activeElement?.textContent ?? "none");
  }

  // Two awaited assignments in one function.
  const step = ref("idle");
  const owner = ref("nobody");
  const editor = ref("nobody");

  watch([step, owner], ([current, who]) => {
    emit("progress", current, who);
  });

  async function load() {
    step.value = "owner";
    owner.value = await ask();
    step.value = "editor";
    editor.value = await ask();
    step.value = "done";
  }

  // A guard after a change, and a local read after an await, around a helper that sets a flag.
  const name = ref("");
  const error = ref("");
  const saving = ref("");

  watch([error, saving], ([message, current]) => {
    emit("saveState", message, current);
  });

  async function persist(value: string) {
    saving.value = value;
    await ask();
    saving.value = "";
  }

  async function save() {
    error.value = "";
    const payload = name.value.trim();
    if (!payload) {
      error.value = "Name required";
      return;
    }
    await persist(payload);
    emit("savedName", payload);
  }

  // A loop that awaits.
  const status = ref("idle");
  const imported = ref(0);

  watch([status, imported], ([text, count]) => {
    emit("importState", text, count);
  });

  async function importAll() {
    imported.value = 0;
    status.value = "starting";
    for (const file of files) {
      status.value = `importing ${file}`;
      await ask();
      imported.value += 1;
    }
    status.value = "done";
  }

  // A promise of a local async function used as a value: chained, and held across a write.
  const note = ref("idle");

  function refresh() {
    note.value = "refreshing";
    void ask()
      .then((text) => {
        note.value = `refreshed by ${text}`;
      })
      .finally(() => {
        emit("settled", note.value);
      });
  }

  async function prefetch() {
    const pending = ask();
    note.value = "waiting";
    const text = await pending;
    note.value = `prefetched by ${text}`;
  }

  // Writes after a try statement whose block and catch clause may return.
  const sendBusy = ref(false);
  const outcome = ref("");
  const total = ref(0);

  watch([sendBusy, outcome], ([sendingNow, text]) => {
    emit("sending", sendingNow, text);
  });

  async function send() {
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
    emit("sent", total.value);
  }

  // A watcher that calls a function which reassigns its parameter.
  const volume = ref(4);
  const level = ref(4);

  function apply(value: number) {
    if (value > 10) value = 10;
    level.value = value;
    emit("clamped", value);
  }

  watch(volume, (next) => {
    apply(next * 2);
  });

  return (
    <section class="sync-desk" aria-label="Sync desk">
      <button type="button" onClick={suggest}>
        Suggest
      </button>
      <button type="button" ref={confirm}>
        Use this email
      </button>
      <p>
        {email.value}: {checking.value ? "checking" : valid.value ? "valid" : "invalid"}
      </p>
      <button type="button" onClick={load}>
        Load
      </button>
      <p>
        Step: {step.value}, owner {owner.value}, editor {editor.value}
      </p>
      <label>
        Name
        <input
          name="name"
          onInput={(event) => (name.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>{saving.value === "" ? error.value || "Not saving" : `Saving ${saving.value}`}</p>
      <button type="button" onClick={importAll}>
        Import
      </button>
      <p>
        Import: {status.value}, {imported.value} imported
      </p>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
      <button type="button" onClick={prefetch}>
        Prefetch
      </button>
      <p>Note: {note.value}</p>
      <button type="button" onClick={send}>
        Send
      </button>
      <p>Send: {sendBusy.value ? "sending" : outcome.value === "" ? "not sent" : outcome.value}</p>
      <button type="button" onClick={() => (volume.value += 3)}>
        Louder
      </button>
      <p>Level: {level.value}</p>
      <div role="group" aria-label="Server">
        <button type="button" onClick={() => answer("Ada")}>
          Reply
        </button>
        <button type="button" onClick={() => answer("")}>
          Decline
        </button>
        <button type="button" onClick={fail}>
          Fail
        </button>
      </div>
    </section>
  );
}
