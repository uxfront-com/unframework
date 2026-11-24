import { Transition } from "./_unframework/Transition";
import "./Toast.uf.tsx.css";

export default function Toast() {
  return (
    <>
      <Transition name="pop" appear>
        <p class="toast" role="status" data-uf-acfe4ebf="">
          Saved
        </p>
      </Transition>
    </>
  );
}
