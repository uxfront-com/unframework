import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export interface AccountMenuEvents {
  onGreeted$?: QRL<(name: string) => void>;
}

export default component$<AccountMenuProps & AccountMenuEvents>(({ owner, onGreeted$ }) => {
  const step = useSignal("intro");
  const user = useSignal<User | null>(null);

  const start = $(() => {
    step.value = "account";
  });

  const signIn = $(() => {
    user.value = { name: "Ada" };
  });

  const signOut = $(() => {
    user.value = null;
  });

  const greet = $((name: string) => {
    onGreeted$?.(name);
  });

  return (
    <section class="account-menu" aria-label="Account">
      {step.value === "intro" ? (
        <button type="button" onClick$={start}>
          Start
        </button>
      ) : user.value === null ? (
        <button type="button" onClick$={signIn}>
          Sign in
        </button>
      ) : (
        <button type="button" onClick$={signOut}>
          Sign out
        </button>
      )}
      {user.value !== null ? <p>Signed in as {user.value.name}</p> : <p>Nobody signed in</p>}
      {owner ? (
        <button type="button" onClick$={() => greet(owner.name)}>{`Greet ${owner.name}`}</button>
      ) : (
        <p>No owner</p>
      )}
    </section>
  );
});
