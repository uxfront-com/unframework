import { Teleport } from "./_unframework/Teleport";
import "./Toast.uf.tsx.css";

export interface ToastProps {
  message: string;
}

export default function Toast(props: ToastProps) {
  return (
    <>
      <Teleport to="body">
        <div data-teleported="true" class="toast" role="alert" data-uf-416dbabb="">
          <p data-uf-416dbabb="">{props.message}</p>
        </div>
      </Teleport>
    </>
  );
}
