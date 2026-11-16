<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { TransitionConfig } from "svelte/transition";
  import "./Toast.uf.tsx.css";

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
</script>

<p in:enter|global={"pop"} class="toast" role="status" data-uf-acfe4ebf="">Saved</p>
