import "./Banner.css";
import Hint from "./Hint.uf.tsx";

export default function Banner({ tip }: { tip: string }) {
  return (
    <div class="banner">
      <Hint text={tip} />
    </div>
  );
}
