import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { tokenStorage, type Tokens } from '@/services/token-storage'

export interface Usuario {
  id: string
  nome: string
  email: string
}

interface AuthResponse extends Tokens {
  usuario: Usuario
}

export const useAuthStore = defineStore('auth', () => {
  const usuario = ref<Usuario | null>(null)
  const logado = ref(tokenStorage.get() !== null)

  const isAuthenticated = computed(() => logado.value)

  function startSession({ usuario: u, accessToken, refreshToken }: AuthResponse) {
    tokenStorage.set({ accessToken, refreshToken })
    usuario.value = u
    logado.value = true
  }

  async function login(email: string, senha: string) {
    startSession(
      await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, senha },
        auth: false,
      }),
    )
  }

  async function register(nome: string, email: string, senha: string) {
    startSession(
      await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { nome, email, senha },
        auth: false,
      }),
    )
  }

  // Depois de um F5 só temos os tokens; o usuário é buscado na API
  async function loadUsuario() {
    if (logado.value && !usuario.value) {
      usuario.value = await api<Usuario>('/auth/me')
    }
  }

  function logout() {
    tokenStorage.clear()
    usuario.value = null
    logado.value = false
  }

  return { usuario, isAuthenticated, login, register, loadUsuario, logout }
})
