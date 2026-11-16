<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import type { TransitionConfig } from "svelte/transition";
  import "./Drawer.uf.tsx.css";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let shown = $state(true);
  let open = $state(true);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }

  /** The stop of the classes each element runs now, which its next phase stops first. */
  const transitionRuns = new WeakMap<Element, () => void>();

  /** Runs `name`'s classes of one phase on the element, as Vue's `<Transition>` does. */
  function transitionClasses(
    element: Element,
    name: string,
    phase: "enter" | "leave",
  ): () => TransitionConfig {
    return () => {
      // A phase that starts while the other runs, as Svelte reverses one, takes over from it.
      transitionRuns.get(element)?.();
      const from = `${name}-${phase}-from`;
      const active = `${name}-${phase}-active`;
      const to = `${name}-${phase}-to`;
      const event = phase === "enter" ? "introend" : "outroend";
      let frame = 0;
      const stop = () => {
        cancelAnimationFrame(frame);
        element.removeEventListener(event, stop);
        element.classList.remove(from, active, to);
        if (transitionRuns.get(element) === stop) transitionRuns.delete(element);
      };
      transitionRuns.set(element, stop);
      element.addEventListener(event, stop, { once: true });
      element.classList.add(from, active);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          element.classList.remove(from);
          element.classList.add(to);
        });
      });
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
  aria-label="Filters"
  class={className}
  {style}
  data-uf-54e3e959=""
  {...scopeAttributes(attributes)}
>
  <button type="button" onclick={() => (shown = !shown)} data-uf-54e3e959="">Drawer</button
  ><button type="button" onclick={() => (open = !open)} data-uf-54e3e959="">Body</button
  >{#if shown}
    {#if open}
      <p in:enter={"fade"} out:leave={"fade"} class="body" data-uf-54e3e959="">Colour, size</p>
    {/if}
  {/if}
</section>
