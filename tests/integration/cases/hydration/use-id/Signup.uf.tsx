import Field from "./Field.uf.tsx";

export interface SignupProps {
  name: string;
  email: string;
}

// Two instances of one child, so each side counts every id of both in the same order.
export default function Signup({ name, email }: SignupProps) {
  return (
    <form class="signup" aria-label="Sign up">
      <Field label={name} hint="As it appears on your card." />
      <Field label={email} hint="We send the receipt here." />
    </form>
  );
}
