<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, tick, untrack } from "svelte";

  type Props = {
    onlooked?: (sender: string) => void;
    ondropped?: (sender: string) => void;
    onsorted?: (order: string) => void;
    onscaled?: (order: string) => void;
    onbusy?: (count: number, loading: boolean) => void;
    onfailed?: (message: string, loading: boolean) => void;
    oncounted?: (count: number) => void;
  };

  let { onlooked, ondropped, onsorted, onscaled, onbusy, onfailed, oncounted }: Props = $props();

  let sender = $state("");
  let order = $state("newest");
  let answers = $state.raw<string[]>([]);
  let ordering = $state("none");
  let messages = $state.raw<string[]>([]);
  let loading = $state(false);
  let failure = $state("");
  let unread = $state(0);
  let lookupReplies: ((text: string) => void)[] = [];
  let orderReply: ((text: string) => void) | undefined;
  let respond: ((list: string[]) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;

  function lookupReply(): Promise<string> {
    return new Promise<string>((resolve) => {
      lookupReplies = [...lookupReplies, resolve];
    });
  }

  function answerLookups() {
    const waiting = lookupReplies;
    lookupReplies = [];
    waiting.forEach((resolve) => resolve("found"));
  }

  function request(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      respond = resolve;
      fail = reject;
    });
  }

  let previousSender = untrack(() => sender);
  let cleanupSender: (() => void) | undefined;
  $effect.pre(() => {
    const value = sender;
    if (Object.is(value, previousSender)) return;
    previousSender = value;
    untrack(async () => {
      cleanupSender?.();
      const cleanups: (() => void)[] = [];
      cleanupSender = () => {
        for (const cleanup of cleanups) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups.push(cleanup);
      };
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
        ondropped?.(value);
      });
      onlooked?.(value);
      const text = await lookupReply();
      if (!cancelled) {
        answers = [...answers, `${value}: ${text}`];
      }
    });
  });
  onMount(() => () => cleanupSender?.());

  $effect(() => {
    const cleanups_1: (() => void)[] = [];
    const onCleanup = (cleanup: () => void) => {
      cleanups_1.push(cleanup);
    };
    const cleanUp = () => {
      for (const cleanup of cleanups_1) cleanup();
    };
    void (async () => {
      const current = order;
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      onsorted?.(current);
      const text = await new Promise<string>((resolve) => {
        orderReply = resolve;
      });
      if (!cancelled) {
        ordering = `${current} ${text}`;
        onscaled?.(current);
      }
    })();
    return cleanUp;
  });

  let previousMessagesLoading = untrack((): [typeof messages, typeof loading] => [
    messages,
    loading,
  ]);
  $effect.pre(() => {
    const values: [typeof messages, typeof loading] = [messages, loading];
    if (values.every((value, index) => Object.is(value, previousMessagesLoading[index]))) return;
    previousMessagesLoading = values;
    untrack(() => {
      const [list, busy] = values;
      onbusy?.(list.length, busy);
    });
  });

  let previousFailureLoading = untrack((): [typeof failure, typeof loading] => [failure, loading]);
  $effect.pre(() => {
    const values_1: [typeof failure, typeof loading] = [failure, loading];
    if (values_1.every((value, index) => Object.is(value, previousFailureLoading[index]))) return;
    previousFailureLoading = values_1;
    untrack(() => {
      const [message, busy] = values_1;
      onfailed?.(message, busy);
    });
  });

  let previousUnread = untrack(() => unread);
  $effect.pre(() => {
    const value = unread;
    if (Object.is(value, previousUnread)) return;
    previousUnread = value;
    untrack(() => {
      oncounted?.(value);
    });
  });

  async function load() {
    loading = true;
    failure = "";
    try {
      const list = await request();
      messages = list;
    } catch (error) {
      failure = error instanceof Error ? error.message : "unknown";
    }
    loading = false;
  }

  async function refresh() {
    loading = true;
    messages = await request();
    loading = false;
  }

  async function markTwice() {
    const bump = () => {
      unread += 1;
    };
    bump();
    bump();
    await tick();
    bump();
    bump();
  }
</script>

<section class="inbox-lookup" aria-label="Inbox">
  <button type="button" onclick={() => (sender = "Ann")}>Find Ann</button
  ><button type="button" onclick={() => (sender = "Anna")}>Find Anna</button
  ><button type="button" onclick={answerLookups}>Answer lookups</button
  ><ol aria-label="Answers">
    {#each answers as line, index (index)}
      <li>{line}</li>
    {/each}
  </ol
  ><button
    type="button"
    onclick={() => (order = order === "newest" ? "oldest" : "newest")}
  >Switch order</button
  ><button type="button" onclick={() => orderReply?.("ready")}>Answer order</button
  ><p>Order: {ordering}</p
  ><button type="button" onclick={load}>Load</button
  ><button type="button" onclick={refresh}>Refresh</button
  ><button type="button" onclick={() => respond?.(["Hello", "Welcome"])}>Reply</button
  ><button type="button" onclick={() => fail?.(new Error("offline"))}>Fail</button
  ><p
    role="status"
  >{loading ? "Loading" : `${messages.length} messages`}{failure === "" ? "" : `, ${failure}`}</p
  ><button type="button" onclick={markTwice}>Mark twice</button
  ><p>Unread: {unread}</p>
</section>
