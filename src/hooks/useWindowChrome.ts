import { useEffect } from 'react'

export const PANEL_COLOR = '#EFE9E1'

/**
 * Sets the window title and the theme color, which an installed app uses
 * for its title bar.
 */
export function useWindowChrome(title: string, themeColor = PANEL_COLOR) {
  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )
    if (meta) {
      meta.content = themeColor
    }
  }, [themeColor])
}
