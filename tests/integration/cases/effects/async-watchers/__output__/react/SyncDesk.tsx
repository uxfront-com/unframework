import { useEffect, useEffectEvent, useLayoutEffect, useReducer, useRef, useState } from "react";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

export interface SyncDeskEvents {
  onChecked?: (email: string) => void;
  onSummary?: (text: string) => void;
  onFocused?: (name: string) => void;
  onProgress?: (step: string, owner: string) => void;
  onSaveState?: (error: string, name: string) => void;
  onSavedName?: (name: string) => void;
  onImportState?: (status: string, count: number) => void;
  onSettled?: (note: string) => void;
  onSending?: (busy: boolean, outcome: string) => void;
  onSent?: (count: number) => void;
  onClamped?: (level: number) => void;
}

async function validate(value: string): Promise<boolean> {
  return value.includes("@");
}

export default function SyncDesk({
  files,
  onChecked,
  onSummary,
  onFocused,
  onProgress,
  onSaveState,
  onSavedName,
  onImportState,
  onSettled,
  onSending,
  onSent,
  onClamped,
}: SyncDeskProps & SyncDeskEvents) {
  const filesRef = useRef(files);
  const onFocusedRef = useRef(onFocused);
  const onSavedNameRef = useRef(onSavedName);
  const onSettledRef = useRef(onSettled);
  const onSentRef = useRef(onSent);
  useLayoutEffect(() => {
    filesRef.current = files;
    onFocusedRef.current = onFocused;
    onSavedNameRef.current = onSavedName;
    onSettledRef.current = onSettled;
    onSentRef.current = onSent;
  });

  const waiting = useRef<Waiting[]>([]);

  function ask(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      waiting.current = [...waiting.current, { resolve, reject }];
    });
  }

  function answer(text: string) {
    const [first, ...rest] = waiting.current;
    waiting.current = rest;
    first?.resolve(text);
  }

  function fail() {
    const [first, ...rest] = waiting.current;
    waiting.current = rest;
    first?.reject(new Error("offline"));
  }

  const [email, setEmail] = useState("ada@example.com");
  const emailRef = useRef(email);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(checking);
  const [valid, setValid] = useState(true);
  const validRef = useRef(valid);
  const confirm = useRef<HTMLButtonElement>(null);

  const previousEmail = useRef(email);
  const onEmailChange = useEffectEvent(async (value: typeof email) => {
    checkingRef.current = true;
    setChecking(checkingRef.current);
    const ok = await validate(value);
    checkingRef.current = false;
    setChecking(checkingRef.current);
    validRef.current = ok;
    setValid(validRef.current);
  });
  useEffect(() => {
    const previous = previousEmail.current;
    if (Object.is(previous, email)) return;
    previousEmail.current = email;
    onEmailChange(email);
  }, [email]);

  const [step, setStep] = useState("idle");
  const stepRef = useRef(step);
  const [owner, setOwner] = useState("nobody");
  const ownerRef = useRef(owner);
  const [editor, setEditor] = useState("nobody");
  const editorRef = useRef(editor);

  const previousStepOwner = useRef<[typeof step, typeof owner]>([step, owner]);
  const onStepOwnerChange = useEffectEvent(([current, who]: [typeof step, typeof owner]) => {
    onProgress?.(current, who);
  });
  useEffect(() => {
    const previous = previousStepOwner.current;
    if (Object.is(previous[0], step) && Object.is(previous[1], owner)) return;
    previousStepOwner.current = [step, owner];
    onStepOwnerChange([step, owner]);
  }, [step, owner]);

  async function load() {
    stepRef.current = "owner";
    setStep(stepRef.current);
    ownerRef.current = await ask();
    setOwner(ownerRef.current);
    stepRef.current = "editor";
    setStep(stepRef.current);
    editorRef.current = await ask();
    setEditor(editorRef.current);
    stepRef.current = "done";
    setStep(stepRef.current);
  }

  const [name, setName] = useState("");
  const nameRef = useRef(name);
  const [error, setError] = useState("");
  const errorRef = useRef(error);
  const [saving, setSaving] = useState("");
  const savingRef = useRef(saving);

  const previousErrorSaving = useRef<[typeof error, typeof saving]>([error, saving]);
  const onErrorSavingChange = useEffectEvent(
    ([message, current]: [typeof error, typeof saving]) => {
      onSaveState?.(message, current);
    },
  );
  useEffect(() => {
    const previous = previousErrorSaving.current;
    if (Object.is(previous[0], error) && Object.is(previous[1], saving)) return;
    previousErrorSaving.current = [error, saving];
    onErrorSavingChange([error, saving]);
  }, [error, saving]);

  async function persist(value: string) {
    savingRef.current = value;
    setSaving(savingRef.current);
    await ask();
    savingRef.current = "";
    setSaving(savingRef.current);
  }

  async function save() {
    errorRef.current = "";
    setError(errorRef.current);
    const payload = nameRef.current.trim();
    if (!payload) {
      errorRef.current = "Name required";
      setError(errorRef.current);
      return;
    }
    await persist(payload);
    onSavedNameRef.current?.(payload);
  }

  const [status, setStatus] = useState("idle");
  const statusRef = useRef(status);
  const [imported, setImported] = useState(0);
  const importedRef = useRef(imported);

  const previousStatusImported = useRef<[typeof status, typeof imported]>([status, imported]);
  const onStatusImportedChange = useEffectEvent(
    ([text, count]: [typeof status, typeof imported]) => {
      onImportState?.(text, count);
    },
  );
  useEffect(() => {
    const previous = previousStatusImported.current;
    if (Object.is(previous[0], status) && Object.is(previous[1], imported)) return;
    previousStatusImported.current = [status, imported];
    onStatusImportedChange([status, imported]);
  }, [status, imported]);

  async function importAll() {
    importedRef.current = 0;
    setImported(importedRef.current);
    statusRef.current = "starting";
    setStatus(statusRef.current);
    for (const file of filesRef.current) {
      statusRef.current = `importing ${file}`;
      setStatus(statusRef.current);
      await ask();
      importedRef.current += 1;
      setImported(importedRef.current);
    }
    statusRef.current = "done";
    setStatus(statusRef.current);
  }

  const [note, setNote] = useState("idle");
  const noteRef = useRef(note);

  function refresh() {
    noteRef.current = "refreshing";
    setNote(noteRef.current);
    void ask()
      .then((text) => {
        noteRef.current = `refreshed by ${text}`;
        setNote(noteRef.current);
      })
      .finally(() => {
        onSettledRef.current?.(noteRef.current);
      });
  }

  async function prefetch() {
    const pending = ask();
    noteRef.current = "waiting";
    setNote(noteRef.current);
    const text = await pending;
    noteRef.current = `prefetched by ${text}`;
    setNote(noteRef.current);
  }

  const [sendBusy, setSendBusy] = useState(false);
  const sendBusyRef = useRef(sendBusy);
  const [outcome, setOutcome] = useState("");
  const outcomeRef = useRef(outcome);
  const [total, setTotal] = useState(0);
  const totalRef = useRef(total);

  const previousSendBusyOutcome = useRef<[typeof sendBusy, typeof outcome]>([sendBusy, outcome]);
  const onSendBusyOutcomeChange = useEffectEvent(
    ([sendingNow, text]: [typeof sendBusy, typeof outcome]) => {
      onSending?.(sendingNow, text);
    },
  );
  useEffect(() => {
    const previous = previousSendBusyOutcome.current;
    if (Object.is(previous[0], sendBusy) && Object.is(previous[1], outcome)) return;
    previousSendBusyOutcome.current = [sendBusy, outcome];
    onSendBusyOutcomeChange([sendBusy, outcome]);
  }, [sendBusy, outcome]);

  async function send() {
    sendBusyRef.current = true;
    setSendBusy(sendBusyRef.current);
    outcomeRef.current = "";
    setOutcome(outcomeRef.current);
    try {
      const reply = await ask();
      if (reply === "") {
        outcomeRef.current = "Declined";
        setOutcome(outcomeRef.current);
        sendBusyRef.current = false;
        setSendBusy(sendBusyRef.current);
        return;
      }
      totalRef.current += 1;
      setTotal(totalRef.current);
    } catch (failure) {
      outcomeRef.current = failure instanceof Error ? failure.message : "Failed";
      setOutcome(outcomeRef.current);
      sendBusyRef.current = false;
      setSendBusy(sendBusyRef.current);
      return;
    }
    sendBusyRef.current = false;
    setSendBusy(sendBusyRef.current);
    outcomeRef.current = `Sent ${totalRef.current}`;
    setOutcome(outcomeRef.current);
    onSentRef.current?.(totalRef.current);
  }

  const [volume, setVolume] = useState(4);
  const volumeRef = useRef(volume);
  const [level, setLevel] = useState(4);
  const levelRef = useRef(level);
  const nextTick = useNextTick(
    () =>
      Object.is(checkingRef.current, checking) &&
      Object.is(validRef.current, valid) &&
      Object.is(levelRef.current, level),
  );

  async function suggest() {
    emailRef.current = "ada@lovelace.dev";
    setEmail(emailRef.current);
    await nextTick();
    confirm.current?.focus();
    onFocusedRef.current?.(document.activeElement?.textContent ?? "none");
  }

  function apply(value: number) {
    if (value > 10) value = 10;
    levelRef.current = value;
    setLevel(levelRef.current);
    onClamped?.(value);
  }

  const previousVolume = useRef(volume);
  const onVolumeChange = useEffectEvent((next: typeof volume) => {
    apply(next * 2);
  });
  useEffect(() => {
    const previous = previousVolume.current;
    if (Object.is(previous, volume)) return;
    previousVolume.current = volume;
    onVolumeChange(volume);
  }, [volume]);

  const [waits, setWaits] = useState(0);
  const previousEmail_1 = useRef(email);
  const onEmailChange_1 = useEffectEvent((value: typeof email) => {
    onChecked?.(value);
  });
  useEffect(() => {
    if (
      !Object.is(checkingRef.current, checking) ||
      !Object.is(validRef.current, valid) ||
      !Object.is(levelRef.current, level)
    ) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousEmail_1.current;
    if (Object.is(previous, email)) return;
    previousEmail_1.current = email;
    onEmailChange_1(email);
  }, [email, checking, valid, level, waits]);

  const previousEmailValid = useRef<[typeof email, typeof valid] | undefined>(undefined);
  const onEmailValidChange = useEffectEvent(
    (emailValue: typeof email, validValue: typeof valid) => {
      onSummary?.(`${emailValue} is ${validValue ? "valid" : "invalid"}`);
    },
  );
  useEffect(() => {
    if (
      !Object.is(checkingRef.current, checking) ||
      !Object.is(validRef.current, valid) ||
      !Object.is(levelRef.current, level)
    ) {
      setWaits(waits + 1);
      return;
    }
    const previous = previousEmailValid.current;
    if (previous && Object.is(previous[0], email) && Object.is(previous[1], valid)) return;
    previousEmailValid.current = [email, valid];
    onEmailValidChange(email, valid);
  }, [email, valid, checking, level, waits]);

  return (
    <section className="sync-desk" aria-label="Sync desk">
      <button type="button" onClick={suggest}>
        Suggest
      </button>
      <button type="button" ref={confirm}>
        Use this email
      </button>
      <p>
        {email}: {checking ? "checking" : valid ? "valid" : "invalid"}
      </p>
      <button type="button" onClick={load}>
        Load
      </button>
      <p>
        Step: {step}, owner {owner}, editor {editor}
      </p>
      <label>
        Name
        <input
          name="name"
          onInput={(event) => {
            nameRef.current = (event.currentTarget as HTMLInputElement).value;
            setName(nameRef.current);
          }}
        />
      </label>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>{saving === "" ? error || "Not saving" : `Saving ${saving}`}</p>
      <button type="button" onClick={importAll}>
        Import
      </button>
      <p>
        Import: {status}, {imported} imported
      </p>
      <button type="button" onClick={refresh}>
        Refresh
      </button>
      <button type="button" onClick={prefetch}>
        Prefetch
      </button>
      <p>Note: {note}</p>
      <button type="button" onClick={send}>
        Send
      </button>
      <p>Send: {sendBusy ? "sending" : outcome === "" ? "not sent" : outcome}</p>
      <button
        type="button"
        onClick={() => {
          volumeRef.current += 3;
          setVolume(volumeRef.current);
        }}
      >
        Louder
      </button>
      <p>Level: {level}</p>
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

/**
 * Vue's `nextTick` for one component: the promise resolves once React has rendered the writes
 * made before it and run their effects, and `settled` says nothing they wrote waits to render;
 * in the task of a click or a key that wrote, as on Vue. It resolves when the component unmounts
 * too.
 */
function useNextTick(settled: () => boolean = () => true): () => Promise<void> {
  const pending = useRef<{ ticket: number; resolve: () => void }[]>([]);
  const tickets = useRef(0);
  const mounted = useRef(false);
  const [rendered, render] = useReducer(
    (last: number, ticket: number) => Math.max(last, ticket),
    0,
  );
  useEffect(() => {
    if (!pending.current.length) return;
    // Once every effect of the commit has run.
    queueMicrotask(() => {
      if (!settled()) {
        // What the component's effects wrote has yet to render, and may end where it was, when
        // React commits nothing: a render of its own makes the next look certain.
        tickets.current += 1;
        render(tickets.current);
        return;
      }
      const due = pending.current.filter(({ ticket }) => ticket <= rendered);
      pending.current = pending.current.filter(({ ticket }) => ticket > rendered);
      for (const { resolve } of due) resolve();
    });
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (mounted.current) return;
        const due = pending.current;
        pending.current = [];
        for (const { resolve } of due) resolve();
      });
    };
  }, []);
  return () =>
    new Promise<void>((resolve) => {
      tickets.current += 1;
      const ticket = tickets.current;
      pending.current.push({ ticket, resolve });
      render(ticket);
    });
}
