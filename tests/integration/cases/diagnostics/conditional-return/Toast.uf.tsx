// UF2012 conditional-return: the body returns early when there is no message. The setup runs once
// and the template decides what renders: move the condition into the JSX.
export interface ToastProps {
  message?: string;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <p class="toast" role="status">
      {message}
    </p>
  );
}
