<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { TransitionConfig } from "svelte/transition";
  import "./Toast.uf.tsx.css";

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
</script>

<p in:enter|global={"pop"} class="toast" role="status" data-uf-acfe4ebf="">Saved</p>
