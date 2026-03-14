import type { AuthUser, LoginInput } from '@/types'

const AUTH_KEY = 'loocbooc_auth'

export function getStoredAuth(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(AUTH_KEY)
    if (!stored) return null
    return JSON.parse(stored) as AuthUser
  } catch {
    return null
  }
}

export function setStoredAuth(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_KEY)
}

export function isAuthenticated(): boolean {
  return getStoredAuth() !== null
}

// Mock auth — always succeeds in dev
// Replace with real API call in production
export async function login(input: LoginInput): Promise<AuthUser> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // Try real API first
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (res.ok) {
        const data = await res.json() as { user: AuthUser }
        return data.user
      }
    } catch {
      // Fall through to mock
    }
  }

  // Mock auth for development
  if (process.env.NODE_ENV === 'development' || !apiUrl) {
    await new Promise(resolve => setTimeout(resolve, 800)) // simulate network
    const mockUser: AuthUser = {
      id: 'mock-user-1',
      email: input.email,
      name: 'Brand Admin',
      brandId: 'brand-charcoal',
      brandName: 'Charcoal Clothing',
      apiKey: input.apiKey,
    }
    return mockUser
  }

  throw new Error('Authentication failed. Check your email and API key.')
}

export async function logout(): Promise<void> {
  clearStoredAuth()
}
