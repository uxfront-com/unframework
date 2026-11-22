// UF2001 invalid-props: the props' rest holds what falls through, so it needs `inheritAttrs:
// false` (ADR-0118); without it, what a consumer passes falls through to the root. The safe fix
// turns fallthrough off and imports `defineOptions`.
export default function Field({ label, ...rest }: { label: string }) {
  return (
    <label class="field">
      {label} <input {...rest} />
    </label>
  );
}
