<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";

  export interface Member {
    id: number;
    name: string;
  }

  export interface Inviter {
    name: string;
  }

  interface Draft {
    email?: string;
    tags: string[] | null;
  }

  export interface TeamInviteProps {
    inviter?: Inviter;
    members: Member[];
  }

  type Props = TeamInviteProps & {
    onselect?: (member: Member) => void;
    onremoved?: (name: string) => void;
    onsubmitted?: (email: string) => void;
    ontagged?: (count: number) => void;
    onmoved?: (page: number) => void;
  };

  let { inviter, members, onselect, onremoved, onsubmitted, ontagged, onmoved }: Props = $props();

  const greeting = $derived(inviter ? `Invite as ${inviter.name}` : "Invite as a guest");
  let selected = $state.raw<Member | null>(null);
  let draft = $state.raw<Draft>({ tags: null });
  let page = $state(1);
  const pageCount = $derived(Math.ceil(members.length / 2));
  const visible = $derived(members.slice((page - 1) * 2, page * 2));
  let byPassword = $state(true);
  let seconds = $state(0);
  let timer = $state.raw<ReturnType<typeof setInterval>>();

  function pick(member: Member) {
    selected = member;
  }

  function invite() {
    if (selected) onselect?.(selected);
  }

  function remove() {
    if (!selected) return;
    const member = selected;
    selected = null;
    onremoved?.(member.name);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!draft.email) return;
    onsubmitted?.(draft.email);
  }

  function tag() {
    if (draft.tags) {
      draft = { ...draft, tags: [...draft.tags, "team"] };
    } else {
      draft = { ...draft, tags: ["team"] };
    }
    if (draft.tags) ontagged?.(draft.tags.length);
  }

  function start() {
    clearInterval(timer);
    timer = setInterval(() => {
      seconds += 1;
    }, 1000);
  }

  function stop() {
    clearInterval(timer);
    timer = undefined;
  }

  onMount(() => () => {
    clearInterval(timer);
  });
</script>

<section class="team-invite" aria-label="Invite">
  <h2>{greeting}</h2
  ><ul aria-label="Members">
    {#each visible as member (member.id)}
      <li>
        <button
          type="button"
          aria-pressed={selected !== null && selected.id === member.id}
          onclick={() => pick(member)}
        >{member.name}</button>
      </li>
    {/each}
  </ul
  ><div class="pager" role="group" aria-label="Pages">
    {#if page > 1}
      <button
        type="button"
        onclick={() => {
          page -= 1;
          onmoved?.(page);
        }}
      >Previous</button>
    {/if}<span>Page {page} of {pageCount}</span
    >{#if page < pageCount}
      <button
        type="button"
        onclick={() => {
          page += 1;
          onmoved?.(page);
        }}
      >Next</button>
    {/if}
  </div
  ><p role="status">{selected ? `Selected: ${selected.name}` : "Nobody selected"}</p
  ><button type="button" onclick={invite}>Invite</button
  ><button type="button" onclick={remove}>Remove</button
  ><form aria-label="Email invite" onsubmit={submit}>
    <label>Email<input
      type="email"
      name="email"
      oninput={(event) => (draft = {
        ...draft,
        email: (event.currentTarget as HTMLInputElement).value,
      })}
    /></label
    ><button type="submit">Send</button>
  </form
  ><button type="button" onclick={tag}>Tag as team</button
  ><button
    type="button"
    onclick={() => (byPassword = !byPassword)}
  >{byPassword ? "Use a link" : "Use a password"}</button
  ><div class="field">
    {#if byPassword}
      <input type="password" aria-label="Password" />
    {:else}
      <input type="text" aria-label="Sign-in email" /><small>We send you a link.</small>
    {/if}
  </div
  ><button type="button" onclick={start}>Start the clock</button
  ><button type="button" onclick={stop}>Stop the clock</button
  ><p>Seconds: {seconds}</p>
</section>
