import { tracked } from "@glimmer/tracking";

interface UseControllableStateArgs<T> {
  value: () => T | undefined;
  initial: T;
  onChange: (next: T) => void;
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

class UseControllableState<T> extends Composable<UseControllableStateArgs<T>> {
  set = (next: T) => {
    this.local = next;
    this.args.onChange(next);
  };

  @tracked local: T = this.args.initial;

  get current() {
    return this.args.value() ?? this.local;
  }
}

export function useControllableState<T>(
  owner: object,
  value: () => T | undefined,
  initial: T,
  onChange: (next: T) => void,
): UseControllableState<T> {
  return new UseControllableState<T>(owner, { value, initial, onChange });
}
