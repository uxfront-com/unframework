<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Base from "./Base.svelte";
  import Primary from "./Primary.svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Page.uf.tsx.css";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let linked = $state(true);
  let tone = $state("rgb(29, 78, 216)");
  let pressed = $state("none");

  let items = $state.raw([
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ]);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["page", className]} {style} data-uf-64cf7c28="" {...scopeAttributes(attributes)}>
  <Primary
    href={linked ? "#docs" : undefined}
    disabled={true}
    text="Docs"
    onpress={() => (pressed = "docs")}
    class="wide"
    style="color: {tone}"
    {...{ "data-uf-64cf7c28": "" }}
  /><Base
    disabled={true}
    text="Off"
    onpress={() => (pressed = "off")}
    class={["off", { muted: !linked }]}
    {...{ "data-uf-64cf7c28": "" }}
  /><Base
    text="Save"
    onpress={() => (pressed = "save")}
    class="save"
    {...{ "data-uf-64cf7c28": "" }}
  /><ul aria-label="Items" data-uf-64cf7c28="">
    {#each items as item (item.id)}
      <li data-uf-64cf7c28="">
        <svelte:element
          this={item.href ? "a" : "button"}
          href={(item.href ? "a" : "button") === "a" ? item.href : undefined}
          disabled={(item.href ? "a" : "button") === "button" ? item.disabled : undefined}
          class="item"
          data-uf-64cf7c28=""
        >{item.label}</svelte:element>
      </li>
    {/each}
  </ul
  ><button
    type="button"
    onclick={() => {
      linked = !linked;
      tone = linked ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)";
    }}
    data-uf-64cf7c28=""
  >Toggle</button
  ><output data-uf-64cf7c28="">{pressed}</output>
</section>
