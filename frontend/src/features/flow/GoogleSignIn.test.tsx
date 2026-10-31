import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GoogleButton } from './GoogleSignIn'

const scripts = () => Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]'))

afterEach(() => {
  scripts().forEach((s) => s.remove())
  delete window.google
  vi.unstubAllEnvs()
})

it('a failed load is not cached: the next sheet loads the script again and renders the button', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com')
  const first = render(<GoogleButton onProfile={vi.fn()} />)
  expect(scripts()).toHaveLength(1)
  // The script loads but Google is not there (blocked or broken): a failure.
  const failed = scripts()[0]!
  await act(async () => void failed.dispatchEvent(new Event('load')))
  first.unmount()

  const renderButton = vi.fn()
  render(<GoogleButton onProfile={vi.fn()} />)
  expect(scripts()).toHaveLength(1)
  expect(scripts()[0]).not.toBe(failed) // a fresh script, not the cached failure
  window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } }
  await act(async () => void scripts()[0]!.dispatchEvent(new Event('load')))
  expect(renderButton).toHaveBeenCalledTimes(1)
})
