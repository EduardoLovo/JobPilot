<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ApiError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({ nome: '', email: '', senha: '', confirmacao: '' })
const errosCampo = ref<Record<string, string>>({})
const erro = ref('')
const enviando = ref(false)

async function cadastrar() {
  erro.value = ''
  errosCampo.value = {}

  if (form.senha !== form.confirmacao) {
    errosCampo.value = { confirmacao: 'As senhas não conferem' }
    return
  }

  enviando.value = true
  try {
    await auth.register(form.nome, form.email, form.senha)
    await router.push({ name: 'home' })
  } catch (e) {
    if (e instanceof ApiError && e.detalhes.length) {
      // Erros de validação da API aparecem embaixo de cada campo
      errosCampo.value = Object.fromEntries(e.detalhes.map((d) => [d.campo, d.mensagem]))
    } else {
      erro.value = e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'
    }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <section class="auth-card">
    <h1>Criar conta</h1>
    <p class="subtitulo">Organize sua busca por vagas em um só lugar.</p>

    <form novalidate @submit.prevent="cadastrar">
      <label class="field">
        <span>Nome</span>
        <input v-model="form.nome" autocomplete="name" required />
        <small v-if="errosCampo.nome" class="field-erro">{{ errosCampo.nome }}</small>
      </label>

      <label class="field">
        <span>E-mail</span>
        <input v-model="form.email" type="email" autocomplete="email" required />
        <small v-if="errosCampo.email" class="field-erro">{{ errosCampo.email }}</small>
      </label>

      <label class="field">
        <span>Senha</span>
        <input v-model="form.senha" type="password" autocomplete="new-password" required />
        <small v-if="errosCampo.senha" class="field-erro">{{ errosCampo.senha }}</small>
        <small v-else class="field-dica">Mínimo de 8 caracteres</small>
      </label>

      <label class="field">
        <span>Confirmar senha</span>
        <input v-model="form.confirmacao" type="password" autocomplete="new-password" required />
        <small v-if="errosCampo.confirmacao" class="field-erro" data-test="erro-confirmacao">
          {{ errosCampo.confirmacao }}
        </small>
      </label>

      <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

      <button class="btn" type="submit" :disabled="enviando">
        {{ enviando ? 'Criando conta...' : 'Criar conta' }}
      </button>
    </form>

    <p class="rodape">Já tem conta? <RouterLink :to="{ name: 'login' }">Entrar</RouterLink></p>
  </section>
</template>
