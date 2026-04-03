export type ColorSet = {
  accent: string
  ringA: string
  ringB: string
  ringC: string
  glowRgb: string
}

export type ColorTheme =
  | { id: string; name: string; mode: 'static'; colors: ColorSet }
  | { id: string; name: string; mode: 'beat-cycle'; palette: ColorSet[] }
  | { id: string; name: string; mode: 'hue-rotate' }

function hslToComponents(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = l - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp < 1) {
    r1 = c
    g1 = x
  } else if (hp < 2) {
    r1 = x
    g1 = c
  } else if (hp < 3) {
    g1 = c
    b1 = x
  } else if (hp < 4) {
    g1 = x
    b1 = c
  } else if (hp < 5) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function monoRings(
  r: number,
  g: number,
  b: number,
): Pick<ColorSet, 'ringA' | 'ringB' | 'ringC'> {
  return {
    ringA: `rgba(${r}, ${g}, ${b}, 1)`,
    ringB: `rgba(${r}, ${g}, ${b}, 0.8)`,
    ringC: `rgba(${r}, ${g}, ${b}, 0.6)`,
  }
}

function strobeEntry(r: number, g: number, b: number): ColorSet {
  return {
    accent: toHex(r, g, b),
    ...monoRings(r, g, b),
    glowRgb: `${r}, ${g}, ${b}`,
  }
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'default',
    name: 'DEFAULT',
    mode: 'static',
    colors: {
      accent: '#9aa7ae',
      ringA: 'rgba(154, 167, 174, 1)',
      ringB: 'rgba(218, 218, 218, 0.72)',
      ringC: 'rgba(218, 218, 218, 0.5)',
      glowRgb: '154, 167, 174',
    },
  },
  {
    id: 'neon',
    name: 'NEON',
    mode: 'static',
    colors: {
      accent: '#c84dff',
      ...monoRings(200, 77, 255),
      glowRgb: '200, 77, 255',
    },
  },
  {
    id: 'acid',
    name: 'ACID',
    mode: 'static',
    colors: {
      accent: '#39ff14',
      ...monoRings(57, 255, 20),
      glowRgb: '57, 255, 20',
    },
  },
  {
    id: 'blaze',
    name: 'BLAZE',
    mode: 'static',
    colors: {
      accent: '#ff4d00',
      ringA: 'rgba(255, 45, 139, 1)',
      ringB: 'rgba(255, 140, 0, 0.85)',
      ringC: 'rgba(255, 204, 0, 0.7)',
      glowRgb: '255, 100, 50',
    },
  },
  {
    id: 'frost',
    name: 'FROST',
    mode: 'static',
    colors: {
      accent: '#00e5ff',
      ringA: 'rgba(41, 121, 255, 1)',
      ringB: 'rgba(0, 188, 212, 0.85)',
      ringC: 'rgba(178, 235, 242, 0.7)',
      glowRgb: '0, 229, 255',
    },
  },
  {
    id: 'prism',
    name: 'PRISM',
    mode: 'static',
    colors: {
      accent: '#ffffff',
      ringA: 'rgba(255, 0, 255, 1)',
      ringB: 'rgba(0, 255, 255, 0.9)',
      ringC: 'rgba(255, 255, 0, 0.8)',
      glowRgb: '220, 220, 255',
    },
  },
  {
    id: 'strobe',
    name: 'STROBE',
    mode: 'beat-cycle',
    palette: [
      strobeEntry(255, 0, 60),
      strobeEntry(255, 0, 255),
      strobeEntry(0, 200, 255),
      strobeEntry(57, 255, 20),
      strobeEntry(255, 240, 0),
      strobeEntry(255, 107, 0),
    ],
  },
  {
    id: 'gaming',
    name: 'GAMING',
    mode: 'hue-rotate',
  },
]

export function resolveGamingColors(hueAngle: number): ColorSet {
  const h = ((hueAngle % 360) + 360) % 360
  const [r, g, b] = hslToComponents(h, 1, 0.5)
  const [r2, g2, b2] = hslToComponents((h + 40) % 360, 1, 0.5)
  const [r3, g3, b3] = hslToComponents((h + 80) % 360, 1, 0.5)
  const [r4, g4, b4] = hslToComponents((h + 120) % 360, 1, 0.5)
  return {
    accent: toHex(r, g, b),
    ringA: `rgba(${r2}, ${g2}, ${b2}, 1)`,
    ringB: `rgba(${r3}, ${g3}, ${b3}, 0.85)`,
    ringC: `rgba(${r4}, ${g4}, ${b4}, 0.7)`,
    glowRgb: `${r}, ${g}, ${b}`,
  }
}

/** Module-level mutable state read by MainCanvasLayer for glow color */
export const liveThemeState = {
  glowRgb: '154, 167, 174',
}
