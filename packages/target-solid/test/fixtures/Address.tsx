export interface AddressProps {
  name: string;
  street: string;
  city?: string;
}

export default function Address(props: AddressProps) {
  return (
    <pre>
      {props.name}
      {["\n"]}
      {props.street}
      {["\n"]}
      {props.city ?? "-"}
    </pre>
  );
}
