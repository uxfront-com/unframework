<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  interface User {
    name: string;
  }

  export interface AccountMenuProps {
    owner?: User;
  }

  type Props = AccountMenuProps & {
    ongreeted?: (name: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { owner, ongreeted, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["account-menu", className]}
  aria-label="Account"
  {style}
  {...scopeAttributes(attributes)}
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
