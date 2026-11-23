import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface UploadStep {
  id: string;
  label: string;
}

export interface UploadStatusProps {
  fileName: string;
  state: "queued" | "uploading" | "failed";
  percent: number;
  steps: UploadStep[];
  error?: string;
}

export interface UploadStatusSignature {
  Args: UploadStatusProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class UploadStatus extends Component<UploadStatusSignature> {
  get value1() {
    return this.args.state === "failed";
  }

  get value2() {
    return this.args.state === "failed" ? (this.args.error ?? "The upload failed.") : undefined;
  }

  get value3() {
    return !(this.args.state === "failed")
      ? this.args.state === "queued"
        ? "Waiting to start"
        : "Uploading"
      : undefined;
  }

  get value4() {
    return `Upload of ${this.args.fileName}`;
  }

  get value5() {
    return [
      ["color", this.args.state === "failed" ? "#8a1c1c" : "#1f3d5c"] as const,
      ["--upload-percent", this.args.percent] as const,
    ];
  }

  get value6() {
    return classNames("upload", `upload-${this.args.state}`);
  }

  <template><section
      class={{this.value6}}
      aria-label={{this.value4}}
      style={{fallthroughStyle this.value5 @style}}
      ...attributes
    ><h2>{{@fileName}}</h2><div
      role="progressbar"
      aria-label="Upload progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={{enumeratedValue @percent}}
    >{{@percent}}%</div>{{#if this.value1}}<p class="upload-error">{{this.value2}}</p>{{else}}<p>{{this.value3}}</p>{{/if}}<ol>{{#each @steps key="id" as |step|}}<li>{{step.label}}</li>{{/each}}</ol></section></template>
}

/** A class as clsx builds it: strings, arrays and toggle objects, empty tokens left out. */
function classNames(...values: unknown[]): string | undefined {
  const tokens: string[] = [];
  const add = (value: unknown): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") tokens.push(String(value));
    else if (Array.isArray(value)) for (const each of value) add(each);
    else if (typeof value === "object") {
      for (const [name, on] of Object.entries(value)) if (on) tokens.push(name);
    }
  };
  for (const value of values) add(value);
  return tokens.length ? tokens.join(" ") : undefined;
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
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
