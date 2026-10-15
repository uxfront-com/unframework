import Post from "../../../../../integration/cases/slots/named/__output__/react/Post";

export function MisuseProp() {
  // @uf-expect TS2322 Post.prop:author
  return <Post author={42} />;
}
