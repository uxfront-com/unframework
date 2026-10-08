// M1's constructs in this target's shapes, written by hand: `$props()` with a typed destructure or
// `props`, `{#if}` chains, keyed `{#each}`, one `class={[…]}`, `style:` directives, whitespace as
// string-literal mustaches, the printer's glued layout. The same three components on every target:
// a badge (props with defaults, a conditional chain, class and style bindings, bound attributes,
// SVG), a list (nested keyed lists, conditionals inside and around them, a root fragment) and a
// card (the `props` form, a typed spread written out key by key, a static style). lint.test.ts pins
// the L5 configuration against them (ADR-0042): a rule that rejects one of them would force an
// emitter change.

/** File name → contents. */
export const M1_SHAPES: Readonly<Record<string, string>> = {
  "Badge.svelte": `<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface BadgeProps {
    label: string;
    tone?: "info" | "warn";
    count?: number;
    pill?: boolean;
    gap?: string;
    quiet?: boolean;
  }

  let { label, tone = "info", count, pill = false, gap, quiet }: BadgeProps = $props();
</script>

<span
  id="badge"
  class={["badge", { pill }, \`tone-\${tone}\`]}
  style:line-height={1.5}
  style:margin-top={gap}
  style:--gap={gap}
  style:color="red"
  aria-hidden={quiet}
  data-tone={tone}
  title={label}
  >{#if count !== undefined && count > 0}<strong>{count}</strong
    >{:else if tone === "warn"}!{/if}{label}{" "}<svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    aria-hidden="true"
    ><title>Icon</title><circle cx="8" cy="8" r="4" stroke-width="2" /><path d="M0 0h16" /></svg
  ><input id="count" type="number" disabled={quiet} tabindex="0" maxlength="10" readonly /><label
    for="count">Count</label
  ></span
>
`,
  "LinkCard.svelte": `<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  interface LinkAttrs {
    href: string;
    title?: string;
    class?: string;
  }

  export interface LinkCardProps {
    label: string;
    link: LinkAttrs;
    extra?: { id?: string; role?: string };
    accent?: string;
  }

  let props: LinkCardProps = $props();
</script>

<div class={["card", props.accent]} style="padding: 4px; border: 1px solid">
  <a href={props.link.href} title={props.link.title} class={["card-link", props.link.class]}
    >{props.label}</a
  ><p id={props.extra?.id} role={props.extra?.role}>More</p>
</div>
`,
  "TodoList.svelte": `<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  interface Todo {
    id: string;
    title: string;
    done?: boolean;
    tags: string[];
  }

  export interface TodoListProps {
    todos: Todo[];
    heading?: string;
  }

  let { todos, heading }: TodoListProps = $props();
</script>

{#if heading}<h2>{heading}</h2>{/if}{#if todos.length > 0}<ol class="todos">
    {#each todos as todo, index (todo.id)}<li class={[{ done: todo.done }]}>
        {index + 1}. {todo.title}{#if todo.tags.length > 0}<ul>
            {#each todo.tags as tag (tag)}<li>{tag}</li>{/each}
          </ul>{/if}
      </li>{/each}
  </ol>{:else}<p>Nothing to do.</p>{/if}
`,
};

/**
 * The shapes M2 emits (ADR-0045 to ADR-0049), as the emitter prints them: test/fixtures holds
 * each, which emit.test.ts pins to the emitter's output and lint.test.ts lints. State and derived
 * values, watchers, effects and lifecycle hooks, listeners and attachments, template refs and
 * ids, and an object form's callback props.
 */
export const M2_FIXTURES: readonly string[] = [
  "Stepper.svelte",
  "Pager.svelte",
  "Ticker.svelte",
  "Panel.svelte",
  "Disclosure.svelte",
  "Chip.svelte",
  "WatchEdges.svelte",
];
