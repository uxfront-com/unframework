import { type CSSProperties, useRef, useState } from "react";

interface User {
  name: string;
}

export interface AccountMenuProps {
  owner?: User;
}

export interface AccountMenuEvents {
  onGreeted?: (name: string) => void;
}

export interface AccountMenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function AccountMenu({
  owner,
  onGreeted,
  className,
  style,
  ...attributes
}: AccountMenuProps & AccountMenuEvents & AccountMenuAttributes) {
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
    <section
      className={cx("account-menu", className)}
      aria-label="Account"
      style={style}
      {...scopeAttributes(attributes)}
    >
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
