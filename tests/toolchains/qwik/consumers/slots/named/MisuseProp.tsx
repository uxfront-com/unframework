import { component$ } from "@qwik.dev/core";

import Post from "../../../../../integration/cases/slots/named/__output__/qwik/Post";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 Post.prop:author
  return <Post author={42} />;
});
