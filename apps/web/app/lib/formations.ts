import { glslFloat } from "@uxfront/scene";
import type { Formation, FormationProgress, FormationShader } from "@uxfront/scene";

/**
 * Wrappers that reuse a catalog formation in ways the catalog doesn't cover.
 * They only rely on the shader contract (`$main`, `$name` identifiers
 * namespaced to `key_name`).
 */

const MAIN = /\bParticle\s+\$main\s*\(/;

type ShaderEdit = (shader: FormationShader) => FormationShader;

const editShader = (formation: Formation, edit: ShaderEdit): Formation => ({
  ...formation,
  shader: () => formation.shader().then(edit),
});

/**
 * Renames the formation's `$main` to `$<inner>` and appends a new `$main`
 * with the given body, which calls `$<inner>(id, sel, f)`.
 */
const wrapMain = (formation: Formation, inner: string, body: string): Formation =>
  editShader(formation, (shader) => {
    if (!MAIN.test(shader.glsl)) {
      throw new Error(`Formation "${formation.key}" has no Particle $main() to wrap.`);
    }
    return {
      ...shader,
      glsl: `${shader.glsl.replace(MAIN, `Particle $${inner}(`)}
Particle $main(uint id, float sel, Frame f) {
${body}
}
`,
    };
  });

/**
 * Holds a formation at a fixed `local` progress, whatever the scroll.
 *
 * The scene runs a formation's `local` from 0 to 1 while its section holds
 * it. The hero starts the page, so it holds its formation only for the first
 * quarter screen of scroll (`HOLD_MARGIN`): the prism would show its rails
 * half grown on load, then grow them out the moment the page scrolls. Held at
 * 1, all seven rails reach their frameworks from the start. Anchors and
 * `update()` see the same `local`.
 */
export function hold(formation: Formation, local: number): Formation {
  const at = <T extends FormationProgress>(progress: T): T => ({ ...progress, local });
  const held = wrapMain(
    formation,
    "held",
    `  f.local = ${glslFloat(local)};
  return $held(id, sel, f);`,
  );
  return {
    ...editShader(held, (shader) =>
      shader.update
        ? { ...shader, update: (uniforms, frame) => shader.update?.(uniforms, at(frame)) }
        : shader,
    ),
    anchors: formation.anchors.map((anchor) => ({
      ...anchor,
      place: (progress, out) => anchor.place(at(progress), out),
      ...(anchor.render && {
        render: (el: HTMLElement, progress: FormationProgress) => anchor.render?.(el, at(progress)),
      }),
    })),
  };
}

/**
 * Lights the particles between `from` and `to` along the x axis and dims the
 * rest to `dim`, so a close-up reads as one part of the formation. The edges
 * fade over `soft` world units. For the prism: the beam comes in from the left
 * (x < -0.5), the glass sits around x = 0 and the rails run out to x = 4.6.
 */
export function spotlight(
  formation: Formation,
  from: number,
  to: number,
  { soft = 0.4, dim = 0.22 }: { soft?: number; dim?: number } = {},
): Formation {
  return wrapMain(
    formation,
    "unlit",
    `  Particle P = $unlit(id, sel, f);
  float lit = smoothstep(${glslFloat(from - soft)}, ${glslFloat(from)}, P.pos.x)
    * (1.0 - smoothstep(${glslFloat(to)}, ${glslFloat(to + soft)}, P.pos.x));
  P.col *= mix(${glslFloat(dim)}, 1.25, lit);
  return P;`,
  );
}
