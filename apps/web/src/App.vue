<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

function sair() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="marca">JobPilot</RouterLink>
    <div v-if="auth.isAuthenticated" class="usuario">
      <span>{{ auth.usuario?.nome }}</span>
      <button class="btn-link" type="button" @click="sair">Sair</button>
    </div>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style>
:root {
  --cor-texto: #1f2328;
  --cor-suave: #59636e;
  --cor-borda: #d0d7de;
  --cor-fundo: #f6f8fa;
  --cor-primaria: #2563eb;
  --cor-primaria-hover: #1d4ed8;
  --cor-erro: #cf222e;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: var(--cor-texto);
  background: var(--cor-fundo);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid var(--cor-borda);
}

.marca {
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}

.usuario {
  display: flex;
  gap: 12px;
  align-items: center;
}

main {
  padding: 24px;
}

.auth-card {
  max-width: 380px;
  margin: 48px auto;
  padding: 32px;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 12px;
}

.auth-card h1 {
  margin: 0 0 4px;
}

.subtitulo,
.rodape {
  color: var(--cor-suave);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
}

.field input {
  padding: 10px 12px;
  font: inherit;
  font-weight: 400;
  border: 1px solid var(--cor-borda);
  border-radius: 8px;
}

.field input:focus {
  outline: 2px solid var(--cor-primaria);
  outline-offset: -1px;
}

.field-erro {
  color: var(--cor-erro);
  font-weight: 400;
}

.field-dica {
  color: var(--cor-suave);
  font-weight: 400;
}

.alert {
  padding: 10px 12px;
  color: var(--cor-erro);
  background: #ffebe9;
  border-radius: 8px;
}

.btn {
  width: 100%;
  padding: 10px 16px;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: var(--cor-primaria);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: var(--cor-primaria-hover);
}

.btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.btn-link {
  padding: 0;
  font: inherit;
  color: var(--cor-primaria);
  background: none;
  border: none;
  cursor: pointer;
}
</style>
