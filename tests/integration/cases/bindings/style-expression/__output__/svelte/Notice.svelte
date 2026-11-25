<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  type NoticeLook = {
    color?: string;
    backgroundColor?: string;
    borderLeft?: string;
    "--notice-accent"?: string;
  };

  type NoticeVars = { "--notice-gap"?: string };

  export interface NoticeProps {
    title: string;
    look?: NoticeLook;
    declarations?: string;
    vars?: NoticeVars;
  }
</script>

<script lang="ts">
  import Badge from "./Badge.svelte";
  import Tag from "./Tag.svelte";
  import { styleText } from "./_unframework/styleText";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "title" | "look" | "declarations" | "vars" | "children" | "class" | "style" | "ref"
  > &
    NoticeProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["div"] | null };

  let {
    title,
    look,
    declarations,
    vars,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let quiet = $state(false);

  function toggle() {
    quiet = !quiet;
  }

  const Component = $derived(quiet ? Tag : Badge);
</script>

<div class={["notice", className]} {style} bind:this={ref} {...attributes}>
  <p style={styleText(look)}>{title}</p
  ><Badge
    label="Permanent"
    tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
    style={styleText(look)}
  /><p style={styleText(declarations)}>Read the details before you continue.</p
  ><Component label="Optional" tone="font-weight: 700" style={styleText(declarations)}
  /><p
    style={styleText(quiet
      ? { color: "rgb(90, 90, 90)" }
      : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" })}
  >This cannot be undone.</p
  ><button
    type="button"
    style={styleText(vars)}
    onclick={toggle}
  >{quiet ? "Emphasise" : "Quieten"}</button>
</div>
