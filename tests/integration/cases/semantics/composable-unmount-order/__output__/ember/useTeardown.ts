import { isDestroying, registerDestructor } from "@ember/destroyable";
import { renderSettled } from "@ember/renderer";

interface UseTeardownArgs {
  name: () => string;
  report: (entry: string) => void;
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

class UseTeardown extends Composable<UseTeardownArgs> {
  get title() {
    return `Panel ${this.args.name()}`;
  }

  readonly flush = (): undefined => {
    return undefined;
  };

  readonly flushAfter = (): undefined => {
    return undefined;
  };

  readonly mount = (): void => {
    afterRender(this.owner, () =>
      registerDestructor(this.owner, () => this.args.report(`${this.args.name()} closed`)),
    );
  };
}

export function useTeardown(
  owner: object,
  name: () => string,
  report: (entry: string) => void,
): UseTeardown {
  return new UseTeardown(owner, { name, report });
}

/** Runs `run` once the render settles, unless its component is gone by then. */
function afterRender(owner: object, run: () => unknown): void {
  // A component on the server never mounts, as Vue registers no hook in a server render.
  if (import.meta.env.SSR) return;
  void renderSettled().then(() => {
    if (!isDestroying(owner)) void run();
  });
}
