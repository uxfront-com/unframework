<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch, watchPostEffect } from "vue";

interface Waiting {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

export interface SyncDeskProps {
  files: string[];
}

const { files } = defineProps<SyncDeskProps>();
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

const email = ref("ada@example.com");
const checking = ref(false);
const valid = ref(true);
const confirm = useTemplateRef<HTMLButtonElement>("confirm");

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

watchPostEffect(() => {
  emit("summary", `${email.value} is ${valid.value ? "valid" : "invalid"}`);
});

async function suggest() {
  email.value = "ada@lovelace.dev";
  await nextTick();
  confirm.value?.focus();
  emit("focused", document.activeElement?.textContent ?? "none");
}

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
</script>

<template>
  <section class="sync-desk" aria-label="Sync desk">
    <button type="button" @click="suggest">Suggest</button>
    <button ref="confirm" type="button">Use this email</button>
    <p>{{ email }}: {{ checking ? "checking" : valid ? "valid" : "invalid" }}</p>
    <button type="button" @click="load">Load</button>
    <p>Step: {{ step }}, owner {{ owner }}, editor {{ editor }}</p>
    <label>Name<input
      name="name"
      @input="(event) => (name = (event.currentTarget as HTMLInputElement).value)"
    /></label>
    <button type="button" @click="save">Save</button>
    <p>{{ saving === "" ? error || "Not saving" : `Saving ${saving}` }}</p>
    <button type="button" @click="importAll">Import</button>
    <p>Import: {{ status }}, {{ imported }} imported</p>
    <button type="button" @click="refresh">Refresh</button>
    <button type="button" @click="prefetch">Prefetch</button>
    <p>Note: {{ note }}</p>
    <button type="button" @click="send">Send</button>
    <p>Send: {{ sendBusy ? "sending" : outcome === "" ? "not sent" : outcome }}</p>
    <button type="button" @click="volume += 3">Louder</button>
    <p>Level: {{ level }}</p>
    <div role="group" aria-label="Server">
      <button type="button" @click="answer('Ada')">Reply</button>
      <button type="button" @click="answer('')">Decline</button>
      <button type="button" @click="fail">Fail</button>
    </div>
  </section>
</template>
