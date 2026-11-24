<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  interface User {
    name: string;
  }

  export interface AccountMenuProps {
    owner?: User;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "owner" | "ongreeted" | "children" | "class" | "style" | "ref"
  > &
    AccountMenuProps & {
      ongreeted?: (name: string) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    owner,
    ongreeted,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let step = $state("intro");
  let user = $state.raw<User | null>(null);

  function start() {
    step = "account";
  }

  function signIn() {
    user = { name: "Ada" };
  }

  function signOut() {
    user = null;
  }

  function greet(name: string) {
    ongreeted?.(name);
  }
</script>

<section
  class={["account-menu", className]}
  aria-label="Account"
  {style}
  bind:this={ref}
  {...attributes}
>
  {#if step === "intro"}
    <button type="button" onclick={start}>Start</button>
  {:else}
    {#if user === null}
      <button type="button" onclick={signIn}>Sign in</button>
    {:else}
      <button type="button" onclick={signOut}>Sign out</button>
    {/if}
  {/if}{#if user !== null}
    <p>Signed in as {user.name}</p>
  {:else}
    <p>Nobody signed in</p>
  {/if}{#if owner}
    <button type="button" onclick={() => greet(owner.name)}>{`Greet ${owner.name}`}</button>
  {:else}
    <p>No owner</p>
  {/if}
</section>
