import { tracked } from "@glimmer/tracking";
import { isDestroying } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

interface UseClockArgs {}

/** A composable's state: the component that called it, which its hooks run with, and its arguments. */
class Composable<Args> {
  readonly owner: object;
  readonly args: Args;

  constructor(owner: object, args: Args) {
    this.owner = owner;
    this.args = args;
  }
}

class UseClock extends Composable<UseClockArgs> {
  @tracked started = false;

  readonly flush = (): undefined => {
    return undefined;
  };

  readonly flushAfter = (): undefined => {
    return undefined;
  };

  readonly mount = (): void => {
    afterRender(this.owner, () => {
      this.started = true;
    });
  };
}

export function useClock(owner: object): UseClock {
  return new UseClock(owner, {});
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}
