import { useRef, useState } from "react";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export interface AccountMenuEvents {
  onGreeted?: (name: string) => void;
}

export default function AccountMenu({ owner, onGreeted }: AccountMenuProps & AccountMenuEvents) {
  const [step, setStep] = useState("intro");
  const stepRef = useRef(step);
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef(user);

  function start() {
    stepRef.current = "account";
    setStep(stepRef.current);
  }

  function signIn() {
    userRef.current = { name: "Ada" };
    setUser(userRef.current);
  }

  function signOut() {
    userRef.current = null;
    setUser(userRef.current);
  }

  function greet(name: string) {
    onGreeted?.(name);
  }

  return (
    <section className="account-menu" aria-label="Account">
      {step === "intro" ? (
        <button key={0} type="button" onClick={start}>
          Start
        </button>
      ) : user === null ? (
        <button key="1.0" type="button" onClick={signIn}>
          Sign in
        </button>
      ) : (
        <button key="1.1" type="button" onClick={signOut}>
          Sign out
        </button>
      )}
      {user !== null ? <p>Signed in as {user.name}</p> : <p>Nobody signed in</p>}
      {owner ? (
        <button type="button" onClick={() => greet(owner.name)}>{`Greet ${owner.name}`}</button>
      ) : (
        <p>No owner</p>
      )}
    </section>
  );
}
