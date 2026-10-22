<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '@/services/api'
import {
  MODALIDADES,
  SENIORIDADES,
  vagasService,
  type Modalidade,
  type Senioridade,
  type Vaga,
} from '@/services/vagas'

const vagas = ref<Vaga[]>([])
const carregando = ref(true)
const erro = ref('')
const filtros = reactive<{
  busca: string
  modalidade: Modalidade | ''
  senioridade: Senioridade | ''
}>({
  busca: '',
  modalidade: '',
  senioridade: '',
})

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    vagas.value = await vagasService.list(filtros)
  } catch (e) {
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'
  } finally {
    carregando.value = false
  }
}

// Espera a pessoa parar de digitar antes de buscar
let timer: ReturnType<typeof setTimeout>
watch(
  () => filtros.busca,
  () => {
    clearTimeout(timer)
    timer = setTimeout(carregar, 300)
  },
)
watch(() => [filtros.modalidade, filtros.senioridade], carregar)

async function remover(vaga: Vaga) {
  if (!window.confirm(`Remover a vaga "${vaga.titulo}"? Essa ação não pode ser desfeita.`)) return

  try {
    await vagasService.remove(vaga.id)
    vagas.value = vagas.value.filter((v) => v.id !== vaga.id)
  } catch (e) {
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível remover a vaga.'
  }
}

onMounted(carregar)
</script>

<template>
  <div class="cabecalho">
    <h1>Vagas</h1>
    <RouterLink class="btn btn-auto" :to="{ name: 'vaga-nova' }">Nova vaga</RouterLink>
  </div>

  <div class="filtros">
    <input
      v-model="filtros.busca"
      type="search"
      placeholder="Buscar pelo título"
      aria-label="Buscar"
    />
    <select v-model="filtros.modalidade" aria-label="Modalidade">
      <option value="">Todas as modalidades</option>
      <option v-for="(rotulo, valor) in MODALIDADES" :key="valor" :value="valor">
        {{ rotulo }}
      </option>
    </select>
    <select v-model="filtros.senioridade" aria-label="Senioridade">
      <option value="">Todas as senioridades</option>
      <option v-for="(rotulo, valor) in SENIORIDADES" :key="valor" :value="valor">
        {{ rotulo }}
      </option>
    </select>
  </div>

  <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

  <p v-if="carregando" class="vazio">Carregando...</p>
  <p v-else-if="!vagas.length && !erro" class="vazio" data-test="vazio">Nenhuma vaga encontrada.</p>

  <ul v-else class="lista">
    <li v-for="vaga in vagas" :key="vaga.id" class="cartao" data-test="vaga">
      <div>
        <h2>{{ vaga.titulo }}</h2>
        <p class="empresa">{{ vaga.empresa.nome }}</p>
        <p class="tags">
          <span v-if="vaga.modalidade" class="tag">{{ MODALIDADES[vaga.modalidade] }}</span>
          <span v-if="vaga.senioridade" class="tag">{{ SENIORIDADES[vaga.senioridade] }}</span>
        </p>
      </div>
      <div class="acoes">
        <a v-if="vaga.url" :href="vaga.url" target="_blank" rel="noopener noreferrer"
          >Ver anúncio</a
        >
        <RouterLink :to="{ name: 'vaga-editar', params: { id: vaga.id } }">Editar</RouterLink>
        <button class="btn-link btn-perigo" type="button" @click="remover(vaga)">Remover</button>
      </div>
    </li>
  </ul>
</template>
