<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, tick, untrack } from "svelte";

  export interface MailboxProps {
    folder: string;
  }

  type Props = MailboxProps & {
    onloaded?: (name: string, unread: number) => void;
    onprogress?: (status: string, attempts: number) => void;
    onseen?: (text: string) => void;
    onnoted?: (text: string) => void;
  };

  let { folder, onloaded, onprogress, onseen, onnoted }: Props = $props();

  let name = $state("Loading");
  let unread = $state(0);
  let status = $state("idle");
  let attempts = $state(0);
  let summary = $state("No messages");
  let timer: ReturnType<typeof setInterval> | undefined;

  let previousNameUnread = untrack((): [typeof name, typeof unread] => [name, unread]);
  $effect.pre(() => {
    const values: [typeof name, typeof unread] = [name, unread];
    if (values.every((value, index) => Object.is(value, previousNameUnread[index]))) return;
    previousNameUnread = values;
    untrack(() => {
      const [nextName, nextUnread] = values;
      onloaded?.(nextName, nextUnread);
    });
  });

  let previousStatusAttempts = untrack((): [typeof status, typeof attempts] => [status, attempts]);
  $effect.pre(() => {
    const values_1: [typeof status, typeof attempts] = [status, attempts];
    if (values_1.every((value, index) => Object.is(value, previousStatusAttempts[index]))) return;
    previousStatusAttempts = values_1;
    untrack(() => {
      const [nextStatus, nextAttempts] = values_1;
      onprogress?.(nextStatus, nextAttempts);
    });
  });

  let previousUnread = untrack(() => unread);
  $effect.pre(() => {
    const value = unread;
    if (Object.is(value, previousUnread)) return;
    previousUnread = value;
    untrack(async () => {
      const text = await Promise.resolve(`${value} unread`);
      summary = text;
    });
  });

  $effect(() => {
    void (async () => {
      const text = `${status} after ${attempts}`;
      await Promise.resolve();
      onseen?.(text);
    })();
  });

  onMount(async () => {
    await Promise.resolve();
    name = folder;
    unread = 3;
  });

  onMount(() => () => {
    clearInterval(timer);
  });

  async function save() {
    const label = name.trim();
    status = `saving ${label}`;
    attempts += 1;
    await tick();
    status = "saved";
  }

  function refreshEverySecond() {
    clearInterval(timer);
    timer = setInterval(() => {
      name = `${folder} (refreshed)`;
      unread += 1;
    }, 1000);
  }

  function markAllRead() {
    queueMicrotask(() => {
      unread = 0;
      name = `${folder}, all read`;
    });
  }

  function note() {
    void Promise.resolve().then(() => {
      onnoted?.(`${name}: ${unread}`);
    });
  }
</script>

<section class="mailbox" aria-label="Mailbox">
  <h2>{name}</h2
  ><p role="status">{summary}</p
  ><p>Status: {status}</p
  ><button type="button" onclick={save}>Save</button
  ><button type="button" onclick={refreshEverySecond}>Refresh every second</button
  ><button type="button" onclick={markAllRead}>Mark all read</button
  ><button type="button" onclick={note}>Note</button>
</section>
