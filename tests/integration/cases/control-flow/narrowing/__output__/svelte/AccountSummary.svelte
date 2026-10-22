<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  interface Team {
    name: string;
  }

  interface Member {
    name: string;
    email: string;
    admin: boolean;
    team?: Team;
  }

  interface Seat {
    holder: string;
  }

  type Plan = { kind: "paid"; renews: string } | { kind: "trial"; daysLeft: number };

  export interface AccountSummaryProps {
    loading: boolean;
    member?: Member;
    uptime?: number;
    storage: number | string;
    plan: Plan;
    seats: (Seat | null)[];
  }

  type Props = AccountSummaryProps & { class?: ClassValue; style?: string };

  let {
    loading,
    member,
    uptime,
    storage,
    plan,
    seats,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["account-summary", className]}
  aria-label="Account"
  {style}
  {...scopeAttributes(attributes)}
>
  {#if loading}
    <p>Loading the account</p>
  {:else if !member}
    <p>Signed out</p>
  {:else}
    <h2>{member.name}</h2>
  {/if}{#if member}
    <p>Signed in as {member.email}</p>
  {/if}{#if member}
    <p>Role: {member.admin ? "administrator" : "member"}</p>
  {:else}
    <p>Role: guest</p>
  {/if}{#if !member}
    <p>No profile</p>
  {:else}
    <p>Profile of {member.name}</p>
  {/if}{#if member && member.team}
    <p>Team: {member.team.name}</p>
  {/if}{#if uptime !== undefined}
    <p>Uptime {uptime.toFixed(1)}%</p>
  {/if}{#if typeof storage === "number"}
    <p>Storage {storage.toFixed(1)} GB</p>
  {:else}
    <p>Storage {storage}</p>
  {/if}{#if plan.kind === "paid"}
    <p>Renews on {plan.renews}</p>
  {:else}
    <p>Trial ends in {plan.daysLeft} days</p>
  {/if}<ul aria-label="Seats">
    {#each seats as seat, index (index)}
      <li>
        {#if seat}<b>{seat.holder}</b>{:else}Vacant{/if}
      </li>
    {/each}
  </ul>
</section>
