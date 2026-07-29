// Pure SVG arc-gauge geometry — a polar point on a circle, and the path
// string for an arc sweeping clockwise from a starting angle. No DOM or
// state dependency, so it's reusable by any gauge-style card and testable
// in isolation. Extracted out of renderHealthScore() (features/summary/
// index.js), which used to redefine this same math as nested closures on
// every single render despite it never varying with card state.
export function arcPoint(cx, cy, r, deg) {
            const rad = (deg - 90) * Math.PI / 180;
            return { x: (cx + r * Math.cos(rad)).toFixed(1), y: (cy + r * Math.sin(rad)).toFixed(1) };
          }

export function arcPath(cx, cy, r, startDeg, sweepDeg) {
            const endDeg = startDeg + sweepDeg;
            const s = arcPoint(cx, cy, r, startDeg), e = arcPoint(cx, cy, r, endDeg);
            return `M ${s.x} ${s.y} A ${r} ${r} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
          }
