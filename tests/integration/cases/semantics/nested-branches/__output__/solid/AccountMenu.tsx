import { Show, createSignal } from "solid-js";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export interface AccountMenuEvents {
  onGreeted?: (name: string) => void;
}

export default function AccountMenu(props: AccountMenuProps & AccountMenuEvents) {
  const [step, setStep] = createSignal("intro");
  const [user, setUser] = createSignal<User | null>(null);

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
    <section class="account-menu" aria-label="Account">
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
