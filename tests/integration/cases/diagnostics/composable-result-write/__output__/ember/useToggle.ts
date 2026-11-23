import { tracked } from "@glimmer/tracking";

interface UseToggleArgs {
  initial: boolean;
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

class UseToggle extends Composable<UseToggleArgs> {
  toggle = () => {
    this.on = !this.on;
  };

  @tracked on = this.args.initial;
}

export function useToggle(owner: object, initial: boolean): UseToggle {
  return new UseToggle(owner, { initial });
}
