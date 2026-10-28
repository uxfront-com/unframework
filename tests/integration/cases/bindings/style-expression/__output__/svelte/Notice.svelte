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
  import type { ClassValue } from "svelte/elements";

  type Props = NoticeProps & { class?: ClassValue; style?: string };

  let { title, look, declarations, vars, class: className, style, ...attributes }: Props = $props();

  let quiet = $state(false);

  function toggle() {
    quiet = !quiet;
  }

  const Component = $derived(quiet ? Tag : Badge);

  function styleText(style: object | string | null | undefined): string | undefined {
    if (style === null || style === undefined || typeof style === "string")
      return style ?? undefined;
    return Object.entries(style)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => {
        const property = key.startsWith("--")
          ? key
          : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        return `${property}: ${value}`;
      })
      .join("; ");
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["notice", className]} {style} {...scopeAttributes(attributes)}>
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
