import { tracked } from "@glimmer/tracking";

interface UseCounterArgs {
  limit: number;
  onLimit: (count: number) => void;
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

class UseCounter extends Composable<UseCounterArgs> {
  increment = () => {
    this.count += this.step;
    if (this.count === this.args.limit) this.args.onLimit(this.count);
  };

  reset = () => {
    this.count = 0;
  };

  @tracked count = 0;

  readonly step = 1;
}

export function useCounter(
  owner: object,
  limit: number,
  onLimit: (count: number) => void,
): UseCounter {
  return new UseCounter(owner, { limit, onLimit });
}
