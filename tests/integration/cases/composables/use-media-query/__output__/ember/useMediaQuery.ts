import { tracked } from "@glimmer/tracking";
import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

interface UseMediaQueryArgs {
  query: string;
}

/** A composable's state: the component that called it, which its hooks run with, and its arguments. */
class Composable<Args> {
  readonly owner: object;
  readonly args: Args;

  constructor(owner: object, args: Args) {
    this.owner = owner;
    this.args = args;
  }
}

class UseMediaQuery extends Composable<UseMediaQueryArgs> {
  update = () => {
    this.matches = this.list?.matches ?? false;
  };

  @tracked matches = false;

  list: MediaQueryList | undefined;

  readonly flush = (): undefined => {
    return undefined;
  };

  readonly flushAfter = (): undefined => {
    return undefined;
  };

  readonly mount = (): void => {
    afterRender(this.owner, () => {
      this.list = window.matchMedia(this.args.query);
      this.update();
      this.list.addEventListener("change", this.update);
    });
    afterRender(this.owner, () =>
      registerDestructor(this.owner, () => {
        this.list?.removeEventListener("change", this.update);
      }),
    );
  };
}

export function useMediaQuery(owner: object, query: string): UseMediaQuery {
  return new UseMediaQuery(owner, { query });
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}
