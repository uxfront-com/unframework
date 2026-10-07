import { defineEmits, ref } from "unframework";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export default function AccountMenu({ owner }: AccountMenuProps) {
  const emit = defineEmits<{ greeted: [name: string] }>();

  const step = ref("intro");
  const user = ref<User | null>(null);

  function start() {
    step.value = "account";
  }

  function signIn() {
    user.value = { name: "Ada" };
  }

  function signOut() {
    user.value = null;
  }

  function greet(name: string) {
    emit("greeted", name);
  }

  return (
    <section class="account-menu" aria-label="Account">
      {step.value === "intro" ? (
        <button type="button" onClick={start}>
          Start
        </button>
      ) : (
        <>
          {user.value === null ? (
            <button type="button" onClick={signIn}>
              Sign in
            </button>
          ) : (
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          )}
        </>
      )}
      {user.value !== null ? <p>Signed in as {user.value.name}</p> : <p>Nobody signed in</p>}
      {owner ? (
        <button type="button" onClick={() => greet(owner.name)}>
          {`Greet ${owner.name}`}
        </button>
      ) : (
        <p>No owner</p>
      )}
    </section>
  );
}
