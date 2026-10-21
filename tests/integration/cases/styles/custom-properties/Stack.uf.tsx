import "./Stack.css";

export default function Stack({ gap, accent }: { gap: string; accent: string }) {
  return (
    <ul class="stack" style={{ "--gap": gap, "--accent": accent }}>
      <li class="item">One</li>
      <li class="item">Two</li>
      <li class="item">Three</li>
    </ul>
  );
}
