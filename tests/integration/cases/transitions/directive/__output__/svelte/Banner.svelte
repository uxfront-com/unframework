<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { vMark } from "./vMark.svelte";
  import type { ClassValue } from "svelte/elements";
  import type { TransitionConfig } from "svelte/transition";
  import "./Banner.uf.tsx.css";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let shown = $state(true);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }

  /** Runs `name`'s classes of one phase on the element, as Vue's `<Transition>` does. */
  function transitionClasses(
    element: Element,
    name: string,
    phase: "enter" | "leave",
  ): () => TransitionConfig {
    const from = `${name}-${phase}-from`;
    const active = `${name}-${phase}-active`;
    const to = `${name}-${phase}-to`;
    let ended = false;
    const end = () => {
      ended = true;
      element.classList.remove(from, active, to);
    };
    element.addEventListener(phase === "enter" ? "introend" : "outroend", end, { once: true });
    element.classList.add(from, active);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (ended) return;
        element.classList.remove(from);
        element.classList.add(to);
      });
    });
    return () => {
      const style = getComputedStyle(element);
      const longest = (delays: string, durations: string) => {
        const each = (list: string) =>
          list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
        const delay = each(delays);
        return Math.max(
          0,
          ...each(durations).map(
            (duration, index) => duration + (delay[index % delay.length] ?? 0),
          ),
        );
      };
      return {
        duration: Math.max(
          longest(style.transitionDelay, style.transitionDuration),
          longest(style.animationDelay, style.animationDuration),
        ),
      };
    };
  }

  /** Runs `name`'s enter classes, as `in:` starts it. */
  function enter(element: Element, name: string): () => TransitionConfig {
    return transitionClasses(element, name, "enter");
  }

  /** Runs `name`'s leave classes, as `out:` starts it. */
  function leave(element: Element, name: string): () => TransitionConfig {
    return transitionClasses(element, name, "leave");
  }
</script>

<section
  aria-label="News"
  class={className}
  {style}
  data-uf-53025c4a=""
  {...scopeAttributes(attributes)}
>
  <button type="button" onclick={() => (shown = false)} data-uf-53025c4a="">Dismiss</button
  >{#if shown}
    <p
      in:enter={"fade"}
      out:leave={"fade"}
      class="banner"
      {@attach vMark(() => "banner")}
      data-uf-53025c4a=""
    >New releases are out.</p>
  {/if}
</section>
