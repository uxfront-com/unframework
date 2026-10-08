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
      <Show when={props.user || undefined}>{(user) => <p>{user().name}</p>}</Show>
      <Show when={props.user || undefined} fallback={<i>anon</i>}>
        {(user) => <b title={user().name}>{user().name}</b>}
      </Show>
      <Switch fallback={<i>none</i>}>
        <Match when={props.user || undefined}>{(user) => <p>{user().name}</p>}</Match>
        <Match when={props.user ? undefined : props.note ? { note: props.note } : undefined}>
          {(narrowed) => <em>{narrowed().note.trim()}</em>}
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
          {(narrowed) => <b>{narrowed().user.name}</b>}
        </Match>
        <Match
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
          {(narrowed) => <p>{narrowed().user.name}</p>}
        </Match>
      </Switch>
      <Show when={props.user && props.user.admin ? { user: props.user } : undefined}>
        {(narrowed) => <b>{narrowed().user.name}</b>}
      </Show>
      <Show when={props.label && props.user ? { user: props.user } : undefined}>
        {(narrowed) => <p>{narrowed().user.name}</p>}
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
      <Show when={props.user?.address?.city || undefined}>{(city) => <p>{city()}</p>}</Show>
      <Show when={props.user || undefined}>
        {(user) => (
          <a
            href={user().link?.href}
            lang={user().link?.lang}
            data-json={JSON.stringify({ user: user() })}
          >
            <For each={user().tags}>{(tag) => <span>{tag}</span>}</For>
          </a>
        )}
      </Show>
      <ul>
        <For each={props.rows}>
          {(row, index) => (
            <li>
              <Show when={row || undefined}>{(row) => <>{row().name}</>}</Show>
              <Show when={index() > 0 && row ? { row } : undefined} fallback="-">
                {(narrowed) => <b>{narrowed().row.name}</b>}
              </Show>
              <Show when={row && row.age !== undefined ? { age: row.age } : undefined}>
                {(narrowed) => <s>{Math.round(narrowed().age)}</s>}
              </Show>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.count !== undefined ? { count: props.count } : undefined}>
        {(narrowed) => <b title={String(narrowed().count)}>{Math.round(narrowed().count)}</b>}
      </Show>
      <Switch>
        <Match when={props.count === undefined}>
          <i>none</i>
        </Match>
        <Match when={props.count === undefined ? undefined : { count: props.count }}>
          {(narrowed) => <u>{narrowed().count.toFixed(1)}</u>}
        </Match>
      </Switch>
      <Show when={props.note != null ? { note: props.note } : undefined}>
        {(narrowed) => <i title={narrowed().note}>{narrowed().note}</i>}
      </Show>
      <Switch>
        <Match when={typeof props.value === "string" ? { value: props.value } : undefined}>
          {(narrowed) => <b>{narrowed().value.toUpperCase()}</b>}
        </Match>
        <Match
          when={
            typeof props.value === "string"
              ? undefined
              : props.value !== null
                ? { value: props.value }
                : undefined
          }
        >
          {(narrowed) => <i>{narrowed().value.toFixed(1)}</i>}
        </Match>
      </Switch>
      <svg>
        <Switch>
          <Match when={props.shape.kind === `circle` ? { shape: props.shape } : undefined}>
            {(narrowed) => <circle r={narrowed().shape.r} />}
          </Match>
          <Match when={props.shape.kind === `circle` ? undefined : { shape: props.shape }}>
            {(narrowed) => <rect width={narrowed().shape.side} />}
          </Match>
        </Switch>
      </svg>
      <Switch>
        <Match when={props.result.ok ? { result: props.result } : undefined}>
          {(narrowed) => <p>{narrowed().result.value}</p>}
        </Match>
        <Match when={props.result.ok ? undefined : { result: props.result }}>
          {(narrowed) => <p>{narrowed().result.error}</p>}
        </Match>
      </Switch>
      <Show
        when={props.format.separator !== null ? { separator: props.format.separator } : undefined}
      >
        {(narrowed) => <b>{narrowed().separator.repeat(2)}</b>}
      </Show>
      <ul>
        <For each={props.places}>
          {(place) => (
            <li>
              <Show when={place === "x" && props.user ? { user: props.user } : undefined}>
                {(narrowed) => <i>{narrowed().user.name}</i>}
              </Show>
            </li>
          )}
        </For>
      </ul>
      <Show when={props.user || undefined} fallback="<anonymous>">
        {(user) => <p>{user().name}</p>}
      </Show>
      <p title={props.attrs.title} id={props.attrs.id}>
        a
      </p>
      <Switch>
        <Match
          when={props.user && props.user.name.length > 2 ? { name: props.user.name } : undefined}
        >
          {(narrowed) => <p>{narrowed().name}</p>}
        </Match>
        <Match when={props.user && props.user.name.length > 2 ? undefined : { user: props.user }}>
          {(narrowed) => <p>{narrowed().user?.name ?? "anon"}</p>}
        </Match>
      </Switch>
      <Show when={props.user || undefined}>
        {(user) => (
          <ul>
            <For each={props.places}>
              {(place) => (
                <li>
                  {user().name}: {place}
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
      <Show when={props.user || undefined}>
        {(user) => <p>{props.places.map((place) => user().name + place).join(", ")}</p>}
      </Show>
      <p>
        <Show when={props.user || undefined}>{(user) => <>{user().name + props.label}</>}</Show>
      </p>
      <p>
        <Show when={props.count !== undefined ? { count: props.count } : undefined}>
          {(narrowed) => <>{narrowed().count.toFixed(1) + props.label}</>}
        </Show>
      </p>
    </div>
  );
}
