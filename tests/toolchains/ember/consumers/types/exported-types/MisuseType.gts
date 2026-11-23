import Button, { type ButtonProps, type ButtonSize } from "../../../../../integration/cases/types/exported-types/__output__/ember/Button.gts";

// @uf-expect TS2322 Button.type:ButtonProps
const props: ButtonProps = { label: "Save", tone: "danger" };
// @uf-expect TS2322 Button.type:ButtonSize
const size: ButtonSize = "huge";

<template>
  <Button @label={{props.label}} data-size={{size}} />
</template>
