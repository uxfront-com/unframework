<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import type { TransitionConfig } from "svelte/transition";
  import "./Menu.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["nav"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["nav"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(true);
  let refreshes = $state(0);

  function refresh() {
    refreshes++;
    open = false;
    setTimeout(() => {
      open = true;
    }, 80);
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

<nav
  class={["menu", className]}
  aria-label="Account"
  {style}
  data-uf-e688a71a=""
  bind:this={ref}
  {...attributes}
>
  <button type="button" aria-expanded={open} onclick={refresh} data-uf-e688a71a="">Refresh</button
  ><p role="status" data-uf-e688a71a="">Refreshes: {refreshes}</p
  >{#if open}
    <ul in:enter={"fade"} out:leave={"fade"} class="items" data-uf-e688a71a="">
      <li data-uf-e688a71a="">Profile</li>
    </ul>
  {/if}
</nav>
