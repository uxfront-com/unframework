import { glslFloat, wrapMain } from "@uxfront/scene";
import type { Formation } from "@uxfront/scene";

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
