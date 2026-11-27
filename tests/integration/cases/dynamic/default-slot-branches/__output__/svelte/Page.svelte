<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Emphasis from "./Emphasis.svelte";
  import FadeAction from "./FadeAction.svelte";
  import Greeting from "./Greeting.svelte";
  import IconAction from "./IconAction.svelte";
  import LabelAction from "./LabelAction.svelte";
  import SwitchAction from "./SwitchAction.svelte";
  import TipAction from "./TipAction.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let linked = $state(true);
  let strong = $state(true);
  let signedIn = $state(true);
  let tips = $state(false);
  const ada = { name: "Ada" };
  const grace = { name: "Grace" };
</script>

<section class={["page", className]} {style} bind:this={ref} {...attributes}>
  <LabelAction href="#docs" label="Docs">Read the docs</LabelAction
  ><LabelAction label="Save">Save the draft</LabelAction><LabelAction href="#home" label="Home"
  /><LabelAction label="Close" /><FadeAction href="#guide" label="Guide">Read the guide</FadeAction
  ><FadeAction label="Send">Send the draft</FadeAction><FadeAction href="#blog" label="Blog"
  /><FadeAction label="Undo" /><IconAction href="#faq" label="FAQ">Read the FAQ</IconAction
  ><IconAction label="Print">Print the draft</IconAction><IconAction href="#news" label="News"
  /><IconAction label="Reset"
  /><SwitchAction href={linked ? "#more" : undefined}>Learn more</SwitchAction
  ><Emphasis {strong}>Mind the gap</Emphasis
  ><Greeting user={signedIn ? ada : undefined}>Welcome back</Greeting
  ><Greeting user={signedIn ? grace : undefined}
  />{#if tips}
    <div class="tips">
      <TipAction href="#tips" label="Tips">Linked tip</TipAction
      ><TipAction label="Help">Button tip</TipAction><TipAction href="#about" label="About"
      /><TipAction label="Hint" />
    </div>
  {/if}<button type="button" onclick={() => (linked = !linked)}>Toggle link</button
  ><button type="button" onclick={() => (strong = !strong)}>Toggle emphasis</button
  ><button type="button" onclick={() => (signedIn = !signedIn)}>Toggle user</button
  ><button type="button" onclick={() => (tips = true)}>Show tips</button>
</section>
