import "./Note.css";

export default function Note({ lines = "one" }: { lines?: "one" | "three" }) {
  return (
    <div class="note">
      <p>First line</p>
      {lines === "three" ? <p>Second line</p> : null}
      {lines === "three" ? <p>Third line</p> : null}
    </div>
  );
}
