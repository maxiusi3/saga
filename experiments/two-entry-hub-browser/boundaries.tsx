import type { AnchorHTMLAttributes } from 'react'

// Only boundary fixtures are synthetic; the hub and its browser adapter are real.
export const useAuthStore = { getState: () => ({ getAccessToken: async () => 'synthetic-browser-session' }) }
export const createClientSupabase = () => ({ storage: { from: () => ({
  uploadToSignedUrl: async (_path: string, _token: string, file: File) => {
    const response = await fetch('/fixture-upload', { method: 'PUT', body: file })
    return response.ok ? { data: {}, error: null } : { error: { statusCode: String(response.status) } }
  },
}) } })
export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />
}
