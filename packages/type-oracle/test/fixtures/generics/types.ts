export interface ListProps<T> {
  items: T[];
  selected?: T;
  onSelect: (item: T) => void;
}

export type Pair<A, B = A> = { first: A; second: B };

export interface Tree<T> {
  value: T;
  children: Tree<T>[];
}

export interface Labelled<T extends string = string> {
  label: T;
}

export type Maybe<T> = T | null;

export interface Boxed<T> extends Labelled {
  box: Maybe<T>;
}
