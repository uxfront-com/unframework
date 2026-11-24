// Props types written in the module that uses them.

interface CardProps {
  title: string;
  count: number;
}

type Tree = { label: string; children: Tree[] };

export function Literal(props: { label: string; count?: number; tags: readonly string[] }) {
  return props;
}

export function Declared(props: CardProps) {
  return props;
}

export function Unions(props: {
  value: string | number | null;
  onChange: (value: string) => void;
}) {
  return props;
}

export function Emits(events: { change: [value: string]; close: [] }) {
  return events;
}

export function List<T>(props: { items: T[]; selected?: T }) {
  return props;
}

export function Recursive(props: Tree) {
  return props;
}

interface Merged {
  a: string;
}

interface Merged {
  b: number;
}

interface Sized {
  size: string;
  label: string;
}

interface Narrow extends Sized {
  size: "sm" | "md";
}

interface Parent {
  child: Child;
}

interface Child extends Parent {
  name: string;
}

type Head = { next: Tail };
type Tail = Head & { value: number };

type AB = "a" | "b";

export function Merging(props: Merged) {
  return props;
}

export function Narrowed(props: Narrow) {
  return props;
}

export function CycleParent(props: Parent) {
  return props;
}

export function CycleChild(props: Child) {
  return props;
}

export function AliasCycle(props: Head) {
  return props;
}

export function Flattened(props: { value: AB | "b" | "c" }) {
  return props;
}

export function Optional(props: { a?: string } & { a: string }) {
  return props;
}

export function Writable(props: { readonly a: string } & { a: string }) {
  return props;
}

interface Zed {
  z: boolean;
}

interface Late {
  a: string;
}

interface Late extends Zed {
  b: number;
}

interface Callable {
  f(a: string | number): void;
}

interface Overloaded extends Callable {
  f(a: string): void;
  f(a: number): void;
}

export function LateBase(props: Late) {
  return props;
}

export function Overloads(props: Overloaded) {
  return props;
}

type Indexed = { [key: string]: number } & { a: number };

export function IndexedPart(props: Indexed) {
  return props;
}
