const KEY = 'jobpilot.tokens'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

// Os tokens ficam no localStorage para a sessão sobreviver a um F5
export const tokenStorage = {
  get(): Tokens | null {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Tokens) : null
  },
  set(tokens: Tokens) {
    localStorage.setItem(KEY, JSON.stringify(tokens))
  },
  clear() {
    localStorage.removeItem(KEY)
  },
}
