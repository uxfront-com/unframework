import Button, { type ButtonProps, type ButtonSize } from "../../../../../integration/cases/types/exported-types/__output__/ember/Button.gts";

const props: ButtonProps = { label: "Save", tone: "secondary" };
const size: ButtonSize = "large";

<template>
  <Button @label={{props.label}} @tone={{props.tone}} data-size={{size}} />
</template>
