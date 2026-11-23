interface UseTotalArgs {
  price: () => number;
  quantity: () => number;
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

class UseTotal extends Composable<UseTotalArgs> {
  get total() {
    return this.args.price() * this.args.quantity();
  }

  get label() {
    return `${this.args.quantity()} × ${this.args.price()} = ${this.total}`;
  }
}

export function useTotal(owner: object, price: () => number, quantity: () => number): UseTotal {
  return new UseTotal(owner, { price, quantity });
}
