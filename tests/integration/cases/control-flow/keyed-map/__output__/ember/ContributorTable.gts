import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Contributor {
  login: string;
  name: string;
  commits: number;
}

export interface ContributorTableProps {
  caption: string;
  contributors: Contributor[];
}

export interface ContributorTableSignature {
  Args: ContributorTableProps & { style?: unknown };
  Element: HTMLElementTagNameMap["table"];
}

export default class ContributorTable extends Component<ContributorTableSignature> {
  value1 = (contributor: NonNullable<this["args"]["contributors"]>[number]) =>
    `https://example.com/people/${contributor.login}`;

  <template><table
      class="contributors"
      style={{fallthroughStyle @style}}
      ...attributes
    ><caption>{{@caption}}</caption><thead><tr><th scope="col">Name</th><th scope="col">Commits</th></tr></thead><tbody>{{#each @contributors key="login" as |contributor|}}<tr><td><a
      href={{this.value1 contributor}}
    >{{contributor.name}}</a></td><td>{{contributor.commits}}</td></tr>{{/each}}</tbody></table></template>
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
