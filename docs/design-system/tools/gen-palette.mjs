// Regenerate the HeroV tonal palette from a seed color with Google's Material Color Utilities.
//
//   npm i @material/material-color-utilities esbuild          (in a scratch folder, not the app)
//   npx esbuild gen-palette.mjs --bundle --platform=node --format=cjs --outfile=gen.cjs
//   node gen.cjs "#535efd" > palette.json
//
// (The library's ESM build uses extensionless imports that Node rejects, hence the esbuild step.)
// Copy the tones you need into docs/design-system/tokens.css (--p10 … --p95, surfaces, outline).
import { argbFromHex, hexFromArgb, themeFromSourceColor, Hct } from "@material/material-color-utilities";

const seed = process.argv[2] || "#535efd";
const theme = themeFromSourceColor(argbFromHex(seed));
const tones = [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100];
const ramp = (p) => Object.fromEntries(tones.map((t) => [t, hexFromArgb(p.tone(t))]));
const scheme = (s) => Object.fromEntries(Object.entries(s.toJSON()).map(([k, v]) => [k, hexFromArgb(v)]));
const h = Hct.fromInt(argbFromHex(seed));

console.log(JSON.stringify({
  seed, hct: { hue: h.hue, chroma: h.chroma, tone: h.tone },
  primary: ramp(theme.palettes.primary),
  secondary: ramp(theme.palettes.secondary),
  neutral: ramp(theme.palettes.neutral),
  neutralVariant: ramp(theme.palettes.neutralVariant),
  light: scheme(theme.schemes.light),
  dark: scheme(theme.schemes.dark),
}, null, 2));
