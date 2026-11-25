import { Teleport } from "@uxfront/unframework";

import "./Toast.css";

export interface ToastProps {
  message: string;
}

export default function Toast({ message }: ToastProps) {
  return (
    <Teleport to="body">
      <div data-teleported class="toast" role="alert">
        <p>{message}</p>
      </div>
    </Teleport>
  );
}
