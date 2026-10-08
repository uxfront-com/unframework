import KeepAlive from "./KeepAlive.uf.tsx";
import Transition from "./Transition.uf.tsx";
import TransitionComponent from "./TransitionComponent.uf.tsx";

export default function Wizard() {
  return (
    <section aria-label="Wizard">
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}
