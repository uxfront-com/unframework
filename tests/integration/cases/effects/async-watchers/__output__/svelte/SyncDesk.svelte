<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick, untrack } from "svelte";

  interface Waiting {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
  }

  export interface SyncDeskProps {
    files: string[];
  }

  type Props = SyncDeskProps & {
    onchecked?: (email: string) => void;
    onsummary?: (text: string) => void;
    onfocused?: (name: string) => void;
    onprogress?: (step: string, owner: string) => void;
    onsavestate?: (error: string, name: string) => void;
    onsavedname?: (name: string) => void;
    onimportstate?: (status: string, count: number) => void;
    onsettled?: (note: string) => void;
    onsending?: (busy: boolean, outcome: string) => void;
    onsent?: (count: number) => void;
    onclamped?: (level: number) => void;
  };

  let {
    files,
    onchecked,
    onsummary,
    onfocused,
    onprogress,
    onsavestate,
    onsavedname,
    onimportstate,
    onsettled,
    onsending,
    onsent,
    onclamped,
  }: Props = $props();

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

  let email = $state("ada@example.com");
  let checking = $state(false);
  let valid = $state(true);
  let confirm: HTMLButtonElement | null = null;

  async function validate(value: string): Promise<boolean> {
    return value.includes("@");
  }

  let previousEmail = untrack(() => email);
  $effect.pre(() => {
    const value = email;
    if (Object.is(value, previousEmail)) return;
    previousEmail = value;
    untrack(async () => {
      checking = true;
      const ok = await validate(value);
      checking = false;
      valid = ok;
    });
  });

  let previousEmail_1 = untrack(() => email);
  $effect(() => {
    const value = email;
    if (Object.is(value, previousEmail_1)) return;
    previousEmail_1 = value;
    untrack(() => {
      onchecked?.(value);
    });
  });

  $effect(() => {
    onsummary?.(`${email} is ${valid ? "valid" : "invalid"}`);
  });

  async function suggest() {
    email = "ada@lovelace.dev";
    await tick();
    confirm?.focus();
    onfocused?.(document.activeElement?.textContent ?? "none");
  }

  let step = $state("idle");
  let owner = $state("nobody");
  let editor = $state("nobody");

  let previousStepOwner = untrack((): [typeof step, typeof owner] => [step, owner]);
  $effect.pre(() => {
    const values: [typeof step, typeof owner] = [step, owner];
    if (values.every((value, index) => Object.is(value, previousStepOwner[index]))) return;
    previousStepOwner = values;
    untrack(() => {
      const [current, who] = values;
      onprogress?.(current, who);
    });
  });

  async function load() {
    step = "owner";
    owner = await ask();
    step = "editor";
    editor = await ask();
    step = "done";
  }

  let name = $state("");
  let error = $state("");
  let saving = $state("");

  let previousErrorSaving = untrack((): [typeof error, typeof saving] => [error, saving]);
  $effect.pre(() => {
    const values_1: [typeof error, typeof saving] = [error, saving];
    if (values_1.every((value, index) => Object.is(value, previousErrorSaving[index]))) return;
    previousErrorSaving = values_1;
    untrack(() => {
      const [message, current] = values_1;
      onsavestate?.(message, current);
    });
  });

  async function persist(value: string) {
    saving = value;
    await ask();
    saving = "";
  }

  async function save() {
    error = "";
    const payload = name.trim();
    if (!payload) {
      error = "Name required";
      return;
    }
    await persist(payload);
    onsavedname?.(payload);
  }

  let status = $state("idle");
  let imported = $state(0);

  let previousStatusImported = untrack((): [typeof status, typeof imported] => [status, imported]);
  $effect.pre(() => {
    const values_2: [typeof status, typeof imported] = [status, imported];
    if (values_2.every((value, index) => Object.is(value, previousStatusImported[index]))) return;
    previousStatusImported = values_2;
    untrack(() => {
      const [text, count] = values_2;
      onimportstate?.(text, count);
    });
  });

  async function importAll() {
    imported = 0;
    status = "starting";
    for (const file of files) {
      status = `importing ${file}`;
      await ask();
      imported += 1;
    }
    status = "done";
  }

  let note = $state("idle");

  function refresh() {
    note = "refreshing";
    void ask()
      .then((text) => {
        note = `refreshed by ${text}`;
      })
      .finally(() => {
        onsettled?.(note);
      });
  }

  async function prefetch() {
    const pending = ask();
    note = "waiting";
    const text = await pending;
    note = `prefetched by ${text}`;
  }

  let sendBusy = $state(false);
  let outcome = $state("");
  let total = $state(0);

  let previousSendBusyOutcome = untrack((): [typeof sendBusy, typeof outcome] => [
    sendBusy,
    outcome,
  ]);
  $effect.pre(() => {
    const values_3: [typeof sendBusy, typeof outcome] = [sendBusy, outcome];
    if (values_3.every((value, index) => Object.is(value, previousSendBusyOutcome[index]))) return;
    previousSendBusyOutcome = values_3;
    untrack(() => {
      const [sendingNow, text] = values_3;
      onsending?.(sendingNow, text);
    });
  });

  async function send() {
    sendBusy = true;
    outcome = "";
    try {
      const reply = await ask();
      if (reply === "") {
        outcome = "Declined";
        sendBusy = false;
        return;
      }
      total += 1;
    } catch (failure) {
      outcome = failure instanceof Error ? failure.message : "Failed";
      sendBusy = false;
      return;
    }
    sendBusy = false;
    outcome = `Sent ${total}`;
    onsent?.(total);
  }

  let volume = $state(4);
  let level = $state(4);

  function apply(value: number) {
    if (value > 10) value = 10;
    level = value;
    onclamped?.(value);
  }

  let previousVolume = untrack(() => volume);
  $effect.pre(() => {
    const next = volume;
    if (Object.is(next, previousVolume)) return;
    previousVolume = next;
    untrack(() => {
      apply(next * 2);
    });
  });
</script>

<section class="sync-desk" aria-label="Sync desk">
  <button type="button" onclick={suggest}>Suggest</button
  ><button type="button" bind:this={confirm}>Use this email</button
  ><p>{email}: {checking ? "checking" : valid ? "valid" : "invalid"}</p
  ><button type="button" onclick={load}>Load</button
  ><p>Step: {step}, owner {owner}, editor {editor}</p
  ><label>Name<input
    name="name"
    oninput={(event) => (name = (event.currentTarget as HTMLInputElement).value)}
  /></label
  ><button type="button" onclick={save}>Save</button
  ><p>{saving === "" ? error || "Not saving" : `Saving ${saving}`}</p
  ><button type="button" onclick={importAll}>Import</button
  ><p>Import: {status}, {imported} imported</p
  ><button type="button" onclick={refresh}>Refresh</button
  ><button type="button" onclick={prefetch}>Prefetch</button
  ><p>Note: {note}</p
  ><button type="button" onclick={send}>Send</button
  ><p>Send: {sendBusy ? "sending" : outcome === "" ? "not sent" : outcome}</p
  ><button type="button" onclick={() => (volume += 3)}>Louder</button
  ><p>Level: {level}</p
  ><div role="group" aria-label="Server">
    <button type="button" onclick={() => answer("Ada")}>Reply</button
    ><button type="button" onclick={() => answer("")}>Decline</button
    ><button type="button" onclick={fail}>Fail</button>
  </div>
</section>
