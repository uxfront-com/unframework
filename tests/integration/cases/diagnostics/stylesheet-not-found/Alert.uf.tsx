// UF5005 stylesheet-not-found: the component imports a stylesheet that does not exist.
import "./Alert.css";

export default function Alert({ message }: { message: string }) {
  return <p class="alert">{message}</p>;
}
