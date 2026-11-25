import TextField from "../../../../../integration/cases/types/utility-types/__output__/solid2/TextField";
import type { TextFieldProps } from "../../../../../integration/cases/types/utility-types/__output__/solid2/TextField";

// @uf-expect TS2322 TextField.type:TextFieldProps
const field: TextFieldProps = { name: "email", label: 1 };

export function MisuseType() {
	return <TextField name={field.name} label="Email" />;
}
