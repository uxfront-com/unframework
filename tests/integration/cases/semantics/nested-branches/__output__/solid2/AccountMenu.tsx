import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit } from "solid-js";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export interface AccountMenuEvents {
  onGreeted?: (name: string) => void;
}

export default function AccountMenu(
  props: AccountMenuProps &
    AccountMenuEvents &
    Omit<ComponentProps<"section">, "owner" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "owner", "onGreeted", "class");

  const [step, setStep] = createState("intro");
  const [user, setUser] = createState<User | null>(null);

  function start() {
    setStep("account");
  }

  function signIn() {
    setUser({ name: "Ada" });
  }

  function signOut() {
    setUser(null);
  }

  function greet(name: string) {
    props.onGreeted?.(name);
  }

  return (
    <section
      class={props.class ? `account-menu ${props.class}` : "account-menu"}
      aria-label="Account"
      {...others}
    >
      <Show
        when={step() === "intro"}
        fallback={
          <Show
            when={user() === null}
            fallback={
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            }
          >
            <button type="button" onClick={signIn}>
              Sign in
            </button>
          </Show>
        }
      >
        <button type="button" onClick={start}>
          Start
        </button>
      </Show>
      <Show
        when={((user) => (user !== null ? { user } : undefined))(user())}
        fallback={<p>Nobody signed in</p>}
      >
        {(narrowed) => <p>Signed in as {narrowed().user.name}</p>}
      </Show>
      <Show when={props.owner} fallback={<p>No owner</p>}>
        {(owner) => (
          <button
            type="button"
            onClick={() => greet(owner().name)}
          >{`Greet ${owner().name}`}</button>
        )}
      </Show>
    </section>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
