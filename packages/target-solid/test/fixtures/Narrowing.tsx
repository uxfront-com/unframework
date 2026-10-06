import { For, Match, Show, Switch, mergeProps } from "solid-js";

interface Account {
  name: string;
  nick?: string;
  admin?: boolean;
  colour?: string;
  age?: number;
  tags: string[];
  address?: { city: string };
  link?: { href: string; lang?: string };
}

interface Circle {
  kind: "circle";
  r: number;
}

interface Square {
  kind: "square";
  side: number;
}

interface Ok {
  ok: true;
  value: string;
}

interface Failed {
  ok: false;
  error: string;
}

interface Format {
  separator: "," | ";" | null;
}

interface Attrs {
  title: string;
  id?: string;
}

export interface NarrowingProps {
  user?: Account;
  note?: string | null;
  rows: (Account | null)[];
  ready: boolean;
  places: string[];
  count?: number;
  value: string | number | null;
  shape: Circle | Square;
  result: Ok | Failed;
  label: string;
  format: Format;
  attrs?: Attrs;
}

export default function Narrowing(rawProps: NarrowingProps) {
  const defaults: Required<Pick<NarrowingProps, "attrs">> = { attrs: { title: "t" } };
  const props = mergeProps(defaults, rawProps);
  return (
    <div>
      <Show keyed when={props.user || undefined}>
        {(user) => <p>{user.name}</p>}
      </Show>
      <Show keyed when={props.user || undefined} fallback={<i>anon</i>}>
        {(user) => <b title={user.name}>{user.name}</b>}
      </Show>
      <Switch fallback={<i>none</i>}>
        <Match keyed when={props.user || undefined}>
          {(user) => <p>{user.name}</p>}
        </Match>
        <Match keyed when={props.user ? undefined : props.note ? { note: props.note } : undefined}>
          {({ note }) => <em>{note.trim()}</em>}
        </Match>
      </Switch>
      <Switch>
        <Match when={!props.ready}>
          <i>wait</i>
        </Match>
        <Match when={!props.user}>
          <i>anon</i>
        </Match>
        <Match
          keyed
          when={
            !props.ready
              ? undefined
              : !props.user
                ? undefined
                : props.user.admin
                  ? { user: props.user }
                  : undefined
          }
        >
          {({ user }) => <b>{user.name}</b>}
        </Match>
        <Match
          keyed
          when={
            !props.ready
              ? undefined
              : !props.user
                ? undefined
                : props.user.admin
                  ? undefined
                  : { user: props.user }
          }
        >
          {({ user }) => <p>{user.name}</p>}
        </Match>
      </Switch>
      <Show keyed when={props.user && props.user.admin ? { user: props.user } : undefined}>
        {({ user }) => <b>{user.name}</b>}
      </Show>
      <Show keyed when={props.label && props.user ? { user: props.user } : undefined}>
        {({ user }) => <p>{user.name}</p>}
      </Show>
      <Show keyed when={props.user || undefined}>
        {(user) => (
          <p
            title={user.nick ? user.nick.trim() : "none"}
            classList={{ grown: user.age !== undefined && user.age > 17 }}
            style={{ color: user.colour }}
          >
            {user.age !== undefined ? user.age.toFixed() : "-"}
            <Show when={props.ready}>
              <b>{user.name}</b>
            </Show>
          </p>
        )}
      </Show>
      <Show keyed when={props.user?.address?.city || undefined}>
        {(city) => <p>{city}</p>}
      </Show>
      <Show keyed when={props.user || undefined}>
        {(user) => (
          <a href={user.link?.href} lang={user.link?.lang} data-json={JSON.stringify({ user })}>
            <For each={user.tags}>{(tag) => <span>{tag}</span>}</For>
          </a>
        )}
      </Show>
      <ul>
        <For each={props.rows}>
          {(row, index) => (
            <li>
              <Show keyed when={row || undefined}>
                {(row) => <>{row.name}</>}
              </Show>
              <Show keyed when={index() > 0 && row ? { row } : undefined} fallback="-">
                {({ row }) => <b>{row.name}</b>}
              </Show>
              <Show keyed when={row && row.age !== undefined ? { age: row.age } : undefined}>
                {({ age }) => <s>{Math.round(age)}</s>}
              </Show>
            </li>
          )}
        </For>
      </ul>
      <Show keyed when={props.count !== undefined ? { count: props.count } : undefined}>
        {({ count }) => <b title={String(count)}>{Math.round(count)}</b>}
      </Show>
      <Switch>
        <Match when={props.count === undefined}>
          <i>none</i>
        </Match>
        <Match keyed when={props.count === undefined ? undefined : { count: props.count }}>
          {({ count }) => <u>{count.toFixed(1)}</u>}
        </Match>
      </Switch>
      <Show keyed when={props.note != null ? { note: props.note } : undefined}>
        {({ note }) => <i title={note}>{note}</i>}
      </Show>
      <Switch>
        <Match keyed when={typeof props.value === "string" ? { value: props.value } : undefined}>
          {({ value }) => <b>{value.toUpperCase()}</b>}
        </Match>
        <Match
          keyed
          when={
            typeof props.value === "string"
              ? undefined
              : props.value !== null
                ? { value: props.value }
                : undefined
          }
        >
          {({ value }) => <i>{value.toFixed(1)}</i>}
        </Match>
      </Switch>
      <svg>
        <Switch>
          <Match keyed when={props.shape.kind === `circle` ? { shape: props.shape } : undefined}>
            {({ shape }) => <circle r={shape.r} />}
          </Match>
          <Match keyed when={props.shape.kind === `circle` ? undefined : { shape: props.shape }}>
            {({ shape }) => <rect width={shape.side} />}
          </Match>
        </Switch>
      </svg>
      <Switch>
        <Match keyed when={props.result.ok ? { result: props.result } : undefined}>
          {({ result }) => <p>{result.value}</p>}
        </Match>
        <Match keyed when={props.result.ok ? undefined : { result: props.result }}>
          {({ result }) => <p>{result.error}</p>}
        </Match>
      </Switch>
      <Show
        keyed
        when={props.format.separator !== null ? { separator: props.format.separator } : undefined}
      >
        {({ separator }) => <b>{separator.repeat(2)}</b>}
      </Show>
      <ul>
        <For each={props.places}>
          {(place) => (
            <li>
              <Show keyed when={place === "x" && props.user ? { user: props.user } : undefined}>
                {({ user }) => <i>{user.name}</i>}
              </Show>
            </li>
          )}
        </For>
      </ul>
      <Show keyed when={props.user || undefined} fallback="<anonymous>">
        {(user) => <p>{user.name}</p>}
      </Show>
      <p title={props.attrs.title} id={props.attrs.id}>
        a
      </p>
      <Switch>
        <Match
          keyed
          when={props.user && props.user.name.length > 2 ? { name: props.user.name } : undefined}
        >
          {({ name }) => <p>{name}</p>}
        </Match>
        <Match
          keyed
          when={props.user && props.user.name.length > 2 ? undefined : { user: props.user }}
        >
          {({ user }) => <p>{user?.name ?? "anon"}</p>}
        </Match>
      </Switch>
      <Show keyed when={props.user || undefined}>
        {(user) => (
          <ul>
            <For each={props.places}>
              {(place) => (
                <li>
                  {user.name}: {place}
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
      <Show keyed when={props.user || undefined}>
        {(user) => <p>{props.places.map((place) => user.name + place).join(", ")}</p>}
      </Show>
      <p>
        <Show keyed when={props.user || undefined}>
          {(user) => <>{user.name + props.label}</>}
        </Show>
      </p>
      <p>
        <Show keyed when={props.count !== undefined ? { count: props.count } : undefined}>
          {({ count }) => <>{count.toFixed(1) + props.label}</>}
        </Show>
      </p>
    </div>
  );
}
