<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface Contact {
    id: string;
    name: string;
  }

  export interface ContactListProps {
    initial: Contact[];
  }

  type Props = ContactListProps & {
    onchoose?: (id: string, position: number) => void;
    onremoved?: (name: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { initial, onchoose, onremoved, class: className, style, ...attributes }: Props = $props();

  let contacts = $state.raw(untrack(() => initial));
  let chosen = $state<string>();

  function pick(entry: Contact, position: number) {
    chosen = entry.id;
    onchoose?.(entry.id, position);
  }

  function drop(entry: Contact) {
    contacts = contacts.filter((other) => other.id !== entry.id);
    onremoved?.(entry.name);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["contact-list", className]}
  aria-label="Contacts"
  {style}
  {...scopeAttributes(attributes)}
>
  <ul>
    {#each contacts as contact, index (contact.id)}
      <li>
        <button
          type="button"
          aria-pressed={chosen === contact.id}
          onclick={() => pick(contact, index)}
        >{contact.name}</button
        ><button
          type="button"
          aria-label={`Remove ${contact.name}`}
          onclick={() => drop(contact)}
        >Remove</button>
      </li>
    {/each}
  </ul
  ><p role="status">Chosen: {chosen ?? "nobody"}</p>
</section>
