// Named like Vue's built-in `<KeepAlive>`, and renders itself (ADR-0053): its own template must
// not write the built-in's tag either.
export default function KeepAlive({ level }: { level: number }) {
  return (
    <div class="level">
      <span>Level {level}</span>
      {level > 0 && <KeepAlive level={level - 1} />}
    </div>
  );
}
