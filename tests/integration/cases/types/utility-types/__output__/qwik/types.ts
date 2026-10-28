// Every option of a field is optional: the component's props pick the ones it requires.
export interface FieldOptions {
  name?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}
