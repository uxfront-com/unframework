import type { TOC } from "@ember/component/template-only";
import Card, { type CardSignature } from "./Card.gts";

export interface PostSignature {
  Args: { author: string } & { style?: unknown };
  Element: CardSignature["Element"];
}

const Post: TOC<PostSignature> = <template><Card
    @style={{@style}}
    ...attributes
  ><:default><p>Slots arrive in M3.</p></:default><:header><h2>Release notes</h2></:header><:footer><small>By {{@author}}</small></:footer></Card></template>;

export default Post;
