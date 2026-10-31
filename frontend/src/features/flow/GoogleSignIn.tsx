import { useEffect, useLayoutEffect, useRef } from 'react'

/* R4: Google sign-in through Google Identity Services, shown only when VITE_GOOGLE_CLIENT_ID is set.
   Without it nothing Google-shaped is rendered (DEC-008: no fake button). */

type Gis = {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void
      renderButton(el: HTMLElement, o: Record<string, unknown>): void
    }
  }
}

declare global {
  interface Window {
    google?: Gis
  }
}

/** The configured client id, or null. Read per call so tests can stub the env. */
export function googleClientId(): string | null {
  const id: unknown = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gis: Promise<Gis> | null = null

function loadGis(): Promise<Gis> {
  gis ??= new Promise<Gis>((resolve, reject) => {
    if (window.google?.accounts) return resolve(window.google)
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in did not load')))
    s.onerror = () => {
      gis = null // let a later sheet try again
      reject(new Error('Google sign-in did not load'))
    }
    document.head.appendChild(s)
  })
  return gis
}

export type GoogleProfile = { name: string; email: string }

/** Name and email from the ID token's payload.
    ponytail: not verified here. It only names the user on this device; a server must verify the
    token before it is trusted for anything. */
export function profileFromCredential(jwt: string): GoogleProfile | null {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const bytes = Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object') return null
    const { given_name, name, email } = body as Record<string, unknown>
    const shown = typeof given_name === 'string' ? given_name : typeof name === 'string' ? name : ''
    return { name: shown, email: typeof email === 'string' ? email : '' }
  } catch {
    return null
  }
}

/** Google's own button, rendered into a box once the script loads. If it never loads, the box stays
    empty and "Continue as guest" still works. */
export function GoogleButton({ onProfile }: { onProfile: (p: GoogleProfile) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef(onProfile)
  useLayoutEffect(() => {
    cb.current = onProfile
  })
  useEffect(() => {
    const clientId = googleClientId()
    if (!clientId) return
    let live = true
    loadGis().then(
      (g) => {
        if (!live || !box.current) return
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => {
            const p = profileFromCredential(r.credential)
            if (p) cb.current(p)
          },
        })
        g.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 280 })
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [])
  return <div ref={box} data-testid="google-signin" className="flex min-h-11 justify-center" />
}
