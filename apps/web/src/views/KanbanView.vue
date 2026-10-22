<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '@/services/api'
import {
  candidaturasService,
  ROTULOS,
  STATUS,
  type Candidatura,
  type StatusCandidatura,
} from '@/services/candidaturas'

const candidaturas = ref<Candidatura[]>([])
const carregando = ref(true)
const erro = ref('')

const arrastando = ref<Candidatura | null>(null)
const colunaAlvo = ref<StatusCandidatura | null>(null)

const porStatus = computed(
  () =>
    Object.fromEntries(
      STATUS.map((status) => [status, candidaturas.value.filter((c) => c.status === status)]),
    ) as Record<StatusCandidatura, Candidatura[]>,
)

// "2026-11-05" vira "05/11/2026" sem passar por Date, que deslocaria o dia pelo fuso
const formatarDia = (dia: string) => dia.split('-').reverse().join('/')

async function carregar() {
  try {
    candidaturas.value = await candidaturasService.list()
  } catch (e) {
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'
  } finally {
    carregando.value = false
  }
}

async function mover(candidatura: Candidatura, novo: StatusCandidatura) {
  erro.value = ''
  const posicao = candidaturas.value.findIndex((c) => c.id === candidatura.id)

  // O card muda de coluna na hora. Enquanto espera, ele fica sem destinos permitidos para não
  // aceitar um segundo movimento (outros cards continuam livres para serem movidos).
  candidaturas.value = [
    { ...candidatura, status: novo, proximosStatus: [] },
    ...candidaturas.value.filter((c) => c.id !== candidatura.id),
  ]

  try {
    const atualizada = await candidaturasService.changeStatus(candidatura.id, novo)
    candidaturas.value = candidaturas.value.map((c) => (c.id === atualizada.id ? atualizada : c))
  } catch (e) {
    // Desfaz só este card. Voltar a lista inteira a uma foto antiga apagaria também o que outros
    // movimentos, feitos enquanto este esperava, já tinham conseguido.
    const restantes = candidaturas.value.filter((c) => c.id !== candidatura.id)
    restantes.splice(Math.min(posicao, restantes.length), 0, candidatura)
    candidaturas.value = restantes
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível mover a candidatura.'
  }
}

async function remover(candidatura: Candidatura) {
  const mensagem = `Remover a candidatura a "${candidatura.vaga.titulo}"? Essa ação não pode ser desfeita.`
  if (!window.confirm(mensagem)) return

  try {
    await candidaturasService.remove(candidatura.id)
    candidaturas.value = candidaturas.value.filter((c) => c.id !== candidatura.id)
  } catch (e) {
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível remover a candidatura.'
  }
}

// Alternativa ao arrastar, que não funciona no celular nem pelo teclado
function moverPeloSeletor(evento: Event, candidatura: Candidatura) {
  const seletor = evento.target as HTMLSelectElement
  const destino = seletor.value as StatusCandidatura | ''
  seletor.value = ''
  if (destino) mover(candidatura, destino)
}

const podeSoltarEm = (status: StatusCandidatura) =>
  arrastando.value?.proximosStatus.includes(status) ?? false

function iniciarArraste(evento: DragEvent, candidatura: Candidatura) {
  arrastando.value = candidatura
  if (evento.dataTransfer) {
    evento.dataTransfer.effectAllowed = 'move'
    // O Firefox só inicia o arraste se houver algum dado
    evento.dataTransfer.setData('text/plain', candidatura.id)
  }
}

function encerrarArraste() {
  arrastando.value = null
  colunaAlvo.value = null
}

function sobreColuna(evento: DragEvent, status: StatusCandidatura) {
  // Sem preventDefault o navegador não deixa soltar: só as colunas permitidas aceitam o card
  if (!podeSoltarEm(status)) return
  evento.preventDefault()
  if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'move'
  colunaAlvo.value = status
}

function saiuDaColuna(evento: DragEvent, status: StatusCandidatura) {
  // O dragleave também dispara ao passar por cima dos elementos de dentro da coluna
  const para = evento.relatedTarget as Node | null
  const saiuDeVerdade = !para || !(evento.currentTarget as Node).contains(para)
  if (saiuDeVerdade && colunaAlvo.value === status) colunaAlvo.value = null
}

async function soltar(evento: DragEvent, status: StatusCandidatura) {
  evento.preventDefault()
  const candidatura = arrastando.value
  encerrarArraste()

  if (candidatura?.proximosStatus.includes(status)) await mover(candidatura, status)
}

onMounted(carregar)
</script>

<template>
  <div class="cabecalho">
    <h1>Candidaturas</h1>
    <RouterLink class="btn btn-auto" :to="{ name: 'vagas' }">Ver vagas</RouterLink>
  </div>

  <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

  <p v-if="carregando" class="vazio">Carregando...</p>

  <template v-else>
    <p v-if="!candidaturas.length && !erro" class="vazio" data-test="vazio">
      Você ainda não tem candidaturas. Em
      <RouterLink :to="{ name: 'vagas' }">Vagas</RouterLink>, clique em "Candidatar-se" para
      começar.
    </p>

    <div class="quadro">
      <section
        v-for="status in STATUS"
        :key="status"
        class="coluna"
        :class="{ permitida: podeSoltarEm(status), alvo: colunaAlvo === status }"
        :data-test="`coluna-${status}`"
        @dragover="sobreColuna($event, status)"
        @dragleave="saiuDaColuna($event, status)"
        @drop="soltar($event, status)"
      >
        <header class="coluna-topo">
          <h2>{{ ROTULOS[status] }}</h2>
          <span class="contagem">{{ porStatus[status].length }}</span>
        </header>

        <article
          v-for="candidatura in porStatus[status]"
          :key="candidatura.id"
          class="card"
          draggable="true"
          data-test="card"
          @dragstart="iniciarArraste($event, candidatura)"
          @dragend="encerrarArraste"
        >
          <h3>{{ candidatura.vaga.titulo }}</h3>
          <p class="empresa">{{ candidatura.vaga.empresa.nome }}</p>
          <p v-if="candidatura.dataAplicacao" class="data">
            Aplicada em {{ formatarDia(candidatura.dataAplicacao) }}
          </p>
          <p v-if="candidatura.proximoFollowup" class="data">
            Follow-up em {{ formatarDia(candidatura.proximoFollowup) }}
          </p>

          <RouterLink
            class="detalhes"
            draggable="false"
            :to="{ name: 'candidatura', params: { id: candidatura.id } }"
            data-test="detalhes"
          >
            Detalhes e etapas
          </RouterLink>

          <div class="card-acoes">
            <select
              :aria-label="`Mover ${candidatura.vaga.titulo}`"
              :disabled="!candidatura.proximosStatus.length"
              @change="moverPeloSeletor($event, candidatura)"
            >
              <option value="">Mover…</option>
              <option v-for="destino in candidatura.proximosStatus" :key="destino" :value="destino">
                {{ ROTULOS[destino] }}
              </option>
            </select>
            <button class="btn-link btn-perigo" type="button" @click="remover(candidatura)">
              Remover
            </button>
          </div>
        </article>

        <p v-if="!porStatus[status].length" class="coluna-vazia">Nenhuma candidatura</p>
      </section>
    </div>
  </template>
</template>

<style scoped>
.quadro {
  display: grid;
  grid-template-columns: repeat(5, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
  overflow-x: auto;
  padding-bottom: 12px;
}

.coluna {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 240px;
  padding: 12px;
  background: #eaeef2;
  border: 2px solid transparent;
  border-radius: 12px;
  transition:
    background 0.15s,
    border-color 0.15s;
}

/* Durante o arraste, destaca onde o card pode ser solto e onde ele vai cair */
.coluna.permitida {
  border-color: var(--cor-borda);
  border-style: dashed;
}

.coluna.alvo {
  background: #ddf4ff;
  border-color: var(--cor-primaria);
}

.coluna-topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coluna-topo h2 {
  margin: 0;
  font-size: 15px;
}

.contagem {
  min-width: 22px;
  padding: 1px 8px;
  font-size: 13px;
  text-align: center;
  background: #fff;
  border-radius: 999px;
}

.card {
  padding: 12px;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 8px;
  cursor: grab;
}

.card:active {
  cursor: grabbing;
}

.card h3 {
  margin: 0 0 2px;
  font-size: 15px;
}

.empresa,
.data {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--cor-suave);
}

.detalhes {
  display: inline-block;
  margin-top: 2px;
  font-size: 13px;
}

.card-acoes {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.card-acoes select {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  font: inherit;
  font-size: 13px;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
}

.coluna-vazia {
  margin: 0;
  font-size: 13px;
  text-align: center;
  color: var(--cor-suave);
}
</style>
