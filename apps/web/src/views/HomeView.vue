<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStatusStore } from '@/stores/status'

const auth = useAuthStore()
const status = useStatusStore()

onMounted(() => status.checkApi())
</script>

<template>
  <h1>Olá{{ auth.usuario ? `, ${auth.usuario.nome}` : '' }}!</h1>
  <p>Suas candidaturas vão aparecer aqui a partir da Sprint 2.</p>
  <p data-test="api-status">
    API:
    <span v-if="status.apiOnline === null">verificando...</span>
    <span v-else-if="status.apiOnline">online</span>
    <span v-else>offline</span>
  </p>
</template>
