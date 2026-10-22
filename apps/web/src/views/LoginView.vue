<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const senha = ref('')
const erro = ref('')
const enviando = ref(false)

// Só aceita caminhos internos para não virar um redirecionamento aberto
function destino() {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
}

async function entrar() {
  erro.value = ''
  enviando.value = true
  try {
    await auth.login(email.value, senha.value)
    await router.push(destino())
  } catch (e) {
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <section class="auth-card">
    <h1>Entrar</h1>
    <p class="subtitulo">Acompanhe suas candidaturas no JobPilot.</p>

    <form novalidate @submit.prevent="entrar">
      <label class="field">
        <span>E-mail</span>
        <input v-model="email" type="email" autocomplete="email" required />
      </label>

      <label class="field">
        <span>Senha</span>
        <input v-model="senha" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

      <button class="btn" type="submit" :disabled="enviando">
        {{ enviando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>

    <p class="rodape">
      Ainda não tem conta? <RouterLink :to="{ name: 'cadastro' }">Criar conta</RouterLink>
    </p>
  </section>
</template>
