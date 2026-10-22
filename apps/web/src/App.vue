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
    <nav v-if="auth.isAuthenticated" class="menu">
      <RouterLink :to="{ name: 'home' }">Candidaturas</RouterLink>
      <RouterLink :to="{ name: 'vagas' }">Vagas</RouterLink>
    </nav>
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

.menu {
  display: flex;
  flex: 1;
  gap: 16px;
  margin-left: 32px;
}

.menu a {
  color: var(--cor-suave);
  text-decoration: none;
}

.menu a.router-link-active {
  color: var(--cor-texto);
  font-weight: 600;
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

.btn-auto {
  display: inline-block;
  width: auto;
  text-align: center;
  text-decoration: none;
}

.cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0;
}

.filtros input,
.filtros select,
.field select,
.field textarea {
  padding: 10px 12px;
  font: inherit;
  font-weight: 400;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 8px;
}

.filtros input {
  flex: 1;
  min-width: 200px;
}

.vazio {
  color: var(--cor-suave);
}

.lista {
  display: grid;
  gap: 12px;
  padding: 0;
  list-style: none;
}

.cartao {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 12px;
}

.cartao h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.empresa {
  margin: 0 0 8px;
  color: var(--cor-suave);
}

.tags {
  display: flex;
  gap: 8px;
  margin: 0;
}

.tag {
  padding: 2px 10px;
  font-size: 13px;
  background: #ddf4ff;
  border-radius: 999px;
}

.acoes {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  font-size: 14px;
}

.btn-pequeno {
  padding: 6px 12px;
  font-size: 14px;
}

.tag-status {
  color: inherit;
  text-decoration: none;
  background: #dafbe1;
}

.btn-perigo {
  color: var(--cor-erro);
}

.form-card {
  max-width: 560px;
  margin: 0 auto;
  padding: 32px;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 12px;
}

.duas-colunas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.botoes {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
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
