import { useEffect, useRef } from 'react'
import {
  COLOR_THEMES,
  liveThemeState,
  resolveGamingColors,
  type ColorSet,
} from '../lib/colorThemes'
import { useAudioStore } from '../stores/audioStore'
import { useBoardStore } from '../stores/boardStore'

function applyColors(colors: ColorSet, isDefault: boolean) {
  const root = document.documentElement
  if (isDefault) {
    root.style.removeProperty('--color-accent')
  } else {
    root.style.setProperty('--color-accent', colors.accent)
  }
  root.style.setProperty('--theme-ring-a', colors.ringA)
  root.style.setProperty('--theme-ring-b', colors.ringB)
  root.style.setProperty('--theme-ring-c', colors.ringC)
  liveThemeState.glowRgb = colors.glowRgb
}

export function useApplyColorTheme() {
  const colorThemeIndex = useBoardStore((s) => s.colorThemeIndex)
  const beatPulse = useAudioStore((s) => s.beatPulse)
  const rafRef = useRef(0)

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const theme = COLOR_THEMES[colorThemeIndex]
    if (!theme) return

    if (theme.mode === 'static') {
      applyColors(theme.colors, theme.id === 'default')
      return
    }

    if (theme.mode === 'beat-cycle') {
      applyColors(theme.palette[0], false)
      return
    }

    // hue-rotate (gaming)
    const start = performance.now()
    const tick = (now: number) => {
      const hue = ((now - start) * 0.072) % 360
      applyColors(resolveGamingColors(hue), false)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [colorThemeIndex])

  // Beat-cycle theme: update on each beat
  useEffect(() => {
    const theme = COLOR_THEMES[colorThemeIndex]
    if (!theme || theme.mode !== 'beat-cycle') return
    applyColors(theme.palette[beatPulse % theme.palette.length], false)
  }, [colorThemeIndex, beatPulse])
}
