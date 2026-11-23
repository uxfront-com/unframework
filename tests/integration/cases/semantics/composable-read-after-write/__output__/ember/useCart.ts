import { tracked } from "@glimmer/tracking";

interface UseCartArgs {}

/** A composable's state: the component that called it, which its hooks run with, and its arguments. */
class Composable<Args> {
  readonly owner: object;
  readonly args: Args;

  constructor(owner: object, args: Args) {
    this.owner = owner;
    this.args = args;
  }
}

class UseCart extends Composable<UseCartArgs> {
  add = (count: number) => {
    this.items += count;
  };

  clear = () => {
    this.items = 0;
  };

  @tracked items = 0;

  get empty() {
    return this.items === 0;
  }
}

export function useCart(owner: object): UseCart {
  return new UseCart(owner, {});
}
