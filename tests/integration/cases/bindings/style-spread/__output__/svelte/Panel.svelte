<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Hint from "./Hint.svelte";
  import type { ClassValue } from "svelte/elements";

  type PanelLook = {
    borderColor?: string;
    borderStyle?: string;
    borderWidth?: string;
    "--panel-gap"?: string;
  };

  interface PanelAttributes {
    id: string;
    title?: string;
    style?: PanelLook;
  }

  interface NoteAttributes {
    title: string;
    style?: string;
  }

  export interface PanelProps {
    heading: string;
    panel: PanelAttributes;
    note?: NoteAttributes;
  }

  type Props = PanelProps & { class?: ClassValue; style?: string };

  let { heading, panel, note, class: className, style, ...attributes }: Props = $props();

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

<div class={["panels", className]} {style} {...scopeAttributes(attributes)}>
  <section id={panel.id} title={panel.title} style={styleText(panel.style)} class="panel">
    <h2 style="margin-bottom: var(--panel-gap, 4px)">{heading}</h2
    ><p title={note?.title} style={styleText(note?.style)}>Changes save as you type.</p
    ><Hint
      text="Saved a moment ago"
      attrs={{ id: "saved-hint", style: "font-style: italic; color: rgb(90, 90, 90)" }}
      style="color: rgb(30, 90, 60)"
    />
  </section>
</div>
