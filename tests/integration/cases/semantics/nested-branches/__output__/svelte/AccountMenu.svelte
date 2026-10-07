<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  interface User {
    name: string;
  }

  export interface AccountMenuProps {
    owner?: User;
  }

  type Props = AccountMenuProps & { ongreeted?: (name: string) => void };

  let { owner, ongreeted }: Props = $props();

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

<section class="account-menu" aria-label="Account">
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
