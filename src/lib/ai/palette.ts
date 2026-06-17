import type { Brief, ColorSystem, DesignSystem, TypographySystem } from './types';

/** Deterministic 32-bit hash so the same brief always yields the same design. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Style keyword → base hue + saturation/lightness character. */
const STYLE_PROFILES: Record<string, { hue: number; sat: number; dark: boolean }> = {
  modern: { hue: 222, sat: 90, dark: false },
  minimal: { hue: 210, sat: 12, dark: false },
  bold: { hue: 14, sat: 85, dark: false },
  elegant: { hue: 280, sat: 35, dark: true },
  playful: { hue: 330, sat: 80, dark: false },
  corporate: { hue: 212, sat: 55, dark: false },
  natural: { hue: 140, sat: 45, dark: false },
  luxury: { hue: 42, sat: 60, dark: true },
};

function profileFor(brief: Brief): { hue: number; sat: number; dark: boolean } {
  const key = brief.style.trim().toLowerCase();
  if (STYLE_PROFILES[key]) return STYLE_PROFILES[key];
  // Derive a stable hue from the brief when the style is free-text.
  const seed = hashString(`${brief.style}:${brief.industry}`);
  return { hue: seed % 360, sat: 60 + (seed % 30), dark: (seed & 1) === 1 };
}

export function buildColorSystem(brief: Brief): ColorSystem {
  const { hue, sat, dark } = profileFor(brief);
  const accentHue = (hue + 150) % 360;
  if (dark) {
    return {
      primary: hslToHex(hue, sat, 62),
      secondary: hslToHex((hue + 30) % 360, sat - 10, 55),
      accent: hslToHex(accentHue, Math.min(sat + 10, 95), 60),
      background: hslToHex(hue, 18, 9),
      surface: hslToHex(hue, 16, 14),
      text: hslToHex(hue, 12, 96),
      muted: hslToHex(hue, 10, 70),
    };
  }
  return {
    primary: hslToHex(hue, sat, 48),
    secondary: hslToHex((hue + 24) % 360, Math.max(sat - 15, 20), 42),
    accent: hslToHex(accentHue, Math.min(sat + 5, 92), 50),
    background: hslToHex(hue, 30, 99),
    surface: hslToHex(hue, 28, 96),
    text: hslToHex(hue, 25, 12),
    muted: hslToHex(hue, 12, 42),
  };
}

const HEADING_FONTS = ['Plus Jakarta Sans', 'Sora', 'Fraunces', 'Space Grotesk', 'Manrope'];
const BODY_FONTS = ['Inter', 'Source Sans 3', 'Work Sans', 'IBM Plex Sans', 'Nunito Sans'];

export function buildTypography(brief: Brief): TypographySystem {
  const seed = hashString(`${brief.companyName}:${brief.style}`);
  return {
    headingFont: HEADING_FONTS[seed % HEADING_FONTS.length]!,
    bodyFont: BODY_FONTS[(seed >>> 3) % BODY_FONTS.length]!,
    scale: [
      { name: 'display', sizeRem: 3.5, weight: 800 },
      { name: 'h1', sizeRem: 2.5, weight: 700 },
      { name: 'h2', sizeRem: 1.875, weight: 700 },
      { name: 'h3', sizeRem: 1.375, weight: 600 },
      { name: 'body', sizeRem: 1, weight: 400 },
      { name: 'small', sizeRem: 0.875, weight: 400 },
    ],
  };
}

/** Generate an inline SVG monogram logo from the company initials + palette. */
export function buildLogo(brief: Brief, colors: ColorSystem): DesignSystem['logo'] {
  const monogram = brief.companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${escapeXml(
      brief.companyName,
    )} logo">`,
    `<rect width="64" height="64" rx="14" fill="${colors.primary}"/>`,
    `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="${colors.background}">${escapeXml(
      monogram,
    )}</text>`,
    `</svg>`,
  ].join('');
  return { svg, monogram };
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildDesignSystem(brief: Brief): DesignSystem {
  const colors = buildColorSystem(brief);
  const { dark } = profileFor(brief);
  return {
    colors,
    typography: buildTypography(brief),
    radiusRem: dark ? 0.5 : 0.875,
    animations: ['fade-up', 'hover-lift', 'gradient-pan'],
    logo: buildLogo(brief, colors),
  };
}
