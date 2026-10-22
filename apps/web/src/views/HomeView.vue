<script setup lang="ts">
import { onMounted } from 'vue'
import { useStatusStore } from '@/stores/status'

const status = useStatusStore()

onMounted(() => status.checkApi())
</script>

<template>
  <h1>Bem-vinda ao JobPilot</h1>
  <p>Seu gerenciador de candidaturas com IA.</p>
  <p data-test="api-status">
    API:
    <span v-if="status.apiOnline === null">verificando...</span>
    <span v-else-if="status.apiOnline">online</span>
    <span v-else>offline</span>
  </p>
</template>
