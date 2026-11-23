import Field from "../../../../../integration/cases/types/child-type-import/__output__/ember/Field.gts";

<template>
  <!-- @uf-expect TS2322 Field.prop:label -->
  <Field @name="email" @label={{1}} />
</template>
