<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError } from '@/services/api'
import { candidaturasService, ROTULOS, type Candidatura } from '@/services/candidaturas'
import { etapasService, TIPOS_ETAPA, type Etapa, type TipoEtapa } from '@/services/etapas'
import { agoraNoCampoLocal, deCampoLocal, formatarDataHora, paraCampoLocal } from '@/utils/datas'

const route = useRoute()
const id = computed(() => route.params.id as string)

const candidatura = ref<Candidatura | null>(null)
const etapas = ref<Etapa[]>([])
const carregando = ref(true)
const naoEncontrada = ref(false)
const erro = ref('')

// Erro da API traz a própria mensagem; qualquer outro (rede fora do ar) vira um aviso genérico
const mensagemDe = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'

// Datas da candidatura
const dataAplicacao = ref('')
const proximoFollowup = ref('')
const salvandoDatas = ref(false)
const datasSalvas = ref(false)

// Formulário de etapa (criar e editar)
const editandoId = ref<string | null>(null)
const form = reactive({
  tipo: 'ENTREVISTA_RH' as TipoEtapa,
  data: agoraNoCampoLocal(),
  anotacoes: '',
})
const errosCampo = ref<Record<string, string>>({})
const enviando = ref(false)

function usarDatas(c: Candidatura) {
  dataAplicacao.value = c.dataAplicacao ?? ''
  proximoFollowup.value = c.proximoFollowup ?? ''
}

async function carregar() {
  try {
    const [dados, lista] = await Promise.all([
      candidaturasService.get(id.value),
      etapasService.list(id.value),
    ])
    candidatura.value = dados
    etapas.value = lista
    usarDatas(dados)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) naoEncontrada.value = true
    else erro.value = mensagemDe(e)
  } finally {
    carregando.value = false
  }
}

async function salvarDatas() {
  erro.value = ''
  datasSalvas.value = false
  salvandoDatas.value = true
  try {
    candidatura.value = await candidaturasService.update(id.value, {
      dataAplicacao: dataAplicacao.value || null,
      proximoFollowup: proximoFollowup.value || null,
    })
    datasSalvas.value = true
  } catch (e) {
    erro.value = mensagemDe(e)
  } finally {
    salvandoDatas.value = false
  }
}

function limparFormulario() {
  editandoId.value = null
  form.tipo = 'ENTREVISTA_RH'
  form.data = agoraNoCampoLocal()
  form.anotacoes = ''
  errosCampo.value = {}
}

function editar(etapa: Etapa) {
  editandoId.value = etapa.id
  form.tipo = etapa.tipo
  form.data = paraCampoLocal(etapa.data)
  form.anotacoes = etapa.anotacoes ?? ''
  errosCampo.value = {}
}

async function salvarEtapa() {
  erro.value = ''
  errosCampo.value = {}

  const instante = deCampoLocal(form.data)
  if (!instante) {
    errosCampo.value = { data: 'Informe a data e a hora' }
    return
  }

  enviando.value = true
  try {
    const dados = { tipo: form.tipo, data: instante, anotacoes: form.anotacoes }
    if (editandoId.value) await etapasService.update(id.value, editandoId.value, dados)
    else await etapasService.create(id.value, dados)

    limparFormulario()
    // A API devolve a lista já em ordem cronológica
    etapas.value = await etapasService.list(id.value)
  } catch (e) {
    if (e instanceof ApiError && e.detalhes.length) {
      errosCampo.value = Object.fromEntries(e.detalhes.map((d) => [d.campo, d.mensagem]))
    } else {
      erro.value = mensagemDe(e)
    }
  } finally {
    enviando.value = false
  }
}

async function remover(etapa: Etapa) {
  if (!window.confirm('Remover esta etapa? Essa ação não pode ser desfeita.')) return

  erro.value = ''
  try {
    await etapasService.remove(id.value, etapa.id)
    if (editandoId.value === etapa.id) limparFormulario()
    etapas.value = await etapasService.list(id.value)
  } catch (e) {
    erro.value = mensagemDe(e)
  }
}

onMounted(carregar)
</script>

<template>
  <RouterLink class="voltar" :to="{ name: 'home' }">← Candidaturas</RouterLink>

  <!-- Fora do bloco da candidatura: se o carregamento falhar, é o único sinal na tela -->
  <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

  <p v-if="carregando" class="vazio">Carregando...</p>

  <template v-else-if="naoEncontrada">
    <h1>Candidatura não encontrada</h1>
    <p class="vazio" data-test="nao-encontrada">
      Ela pode ter sido removida.
      <RouterLink :to="{ name: 'home' }">Voltar para as candidaturas</RouterLink>
    </p>
  </template>

  <template v-else-if="candidatura">
    <header class="titulo">
      <div>
        <h1>{{ candidatura.vaga.titulo }}</h1>
        <p class="empresa">{{ candidatura.vaga.empresa.nome }}</p>
      </div>
      <span class="tag tag-status" data-test="status">{{ ROTULOS[candidatura.status] }}</span>
    </header>

    <section class="bloco">
      <h2>Datas</h2>
      <form class="datas" novalidate @submit.prevent="salvarDatas">
        <label class="field">
          <span>Data da aplicação</span>
          <input v-model="dataAplicacao" type="date" data-test="data-aplicacao" />
        </label>
        <label class="field">
          <span>Próximo follow-up</span>
          <input v-model="proximoFollowup" type="date" data-test="proximo-followup" />
        </label>
        <div class="datas-acao">
          <button
            class="btn btn-auto"
            type="submit"
            :disabled="salvandoDatas"
            data-test="salvar-datas"
          >
            {{ salvandoDatas ? 'Salvando...' : 'Salvar datas' }}
          </button>
          <small v-if="datasSalvas" class="field-dica" role="status" data-test="datas-salvas">
            Datas salvas
          </small>
        </div>
      </form>
    </section>

    <section class="bloco">
      <h2>Linha do tempo</h2>
      <p v-if="!etapas.length" class="vazio" data-test="sem-etapas">
        Nenhuma etapa registrada ainda. Registre triagens, entrevistas e testes abaixo.
      </p>
      <ol v-else class="linha-do-tempo">
        <li v-for="etapa in etapas" :key="etapa.id" data-test="etapa">
          <span class="ponto" aria-hidden="true" />
          <div class="etapa">
            <p class="etapa-titulo">{{ TIPOS_ETAPA[etapa.tipo] }}</p>
            <p class="data">{{ formatarDataHora(etapa.data) }}</p>
            <p v-if="etapa.anotacoes" class="anotacoes">{{ etapa.anotacoes }}</p>
            <div class="acoes-linha">
              <button class="btn-link" type="button" data-test="editar" @click="editar(etapa)">
                Editar
              </button>
              <button
                class="btn-link btn-perigo"
                type="button"
                data-test="remover"
                @click="remover(etapa)"
              >
                Remover
              </button>
            </div>
          </div>
        </li>
      </ol>
    </section>

    <section class="bloco">
      <h2>{{ editandoId ? 'Editar etapa' : 'Nova etapa' }}</h2>
      <form novalidate @submit.prevent="salvarEtapa">
        <div class="duas-colunas">
          <label class="field">
            <span>Tipo</span>
            <select v-model="form.tipo" data-test="tipo">
              <option v-for="(rotulo, valor) in TIPOS_ETAPA" :key="valor" :value="valor">
                {{ rotulo }}
              </option>
            </select>
            <small v-if="errosCampo.tipo" class="field-erro">{{ errosCampo.tipo }}</small>
          </label>
          <label class="field">
            <span>Data e hora</span>
            <input v-model="form.data" type="datetime-local" data-test="data" />
            <small v-if="errosCampo.data" class="field-erro" data-test="erro-data">
              {{ errosCampo.data }}
            </small>
          </label>
        </div>

        <label class="field">
          <span>Anotações (opcional)</span>
          <textarea v-model="form.anotacoes" rows="4" data-test="anotacoes" />
          <small v-if="errosCampo.anotacoes" class="field-erro">{{ errosCampo.anotacoes }}</small>
        </label>

        <div class="botoes">
          <button
            v-if="editandoId"
            class="btn-link"
            type="button"
            data-test="cancelar"
            @click="limparFormulario"
          >
            Cancelar
          </button>
          <button class="btn btn-auto" type="submit" :disabled="enviando" data-test="salvar-etapa">
            {{ enviando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Adicionar etapa' }}
          </button>
        </div>
      </form>
    </section>
  </template>
</template>

<style scoped>
.voltar {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 14px;
}

.titulo {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  max-width: 760px;
}

.titulo h1 {
  margin: 0 0 4px;
}

.empresa {
  margin: 0;
  color: var(--cor-suave);
}

.bloco {
  max-width: 760px;
  margin: 16px 0;
  padding: 20px 24px;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 12px;
}

.bloco h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.datas {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.datas .field {
  margin-bottom: 0;
}

.datas input,
.duas-colunas input {
  padding: 10px 12px;
  font: inherit;
  font-weight: 400;
  border: 1px solid var(--cor-borda);
  border-radius: 8px;
}

.datas-acao {
  display: flex;
  align-items: center;
  gap: 12px;
}

.linha-do-tempo {
  position: relative;
  padding: 0;
  margin: 0;
  list-style: none;
}

.linha-do-tempo li {
  position: relative;
  padding: 0 0 20px 28px;
}

/* A linha vertical liga um ponto ao próximo; a última etapa não leva linha */
.linha-do-tempo li::before {
  position: absolute;
  top: 8px;
  bottom: -8px;
  left: 5px;
  width: 2px;
  content: '';
  background: var(--cor-borda);
}

.linha-do-tempo li:last-child {
  padding-bottom: 0;
}

.linha-do-tempo li:last-child::before {
  display: none;
}

.ponto {
  position: absolute;
  top: 4px;
  left: 0;
  width: 12px;
  height: 12px;
  background: var(--cor-primaria);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--cor-primaria);
}

.etapa-titulo {
  margin: 0;
  font-weight: 600;
}

.data {
  margin: 2px 0 6px;
  font-size: 13px;
  color: var(--cor-suave);
}

.anotacoes {
  margin: 0 0 6px;
  font-size: 14px;
  white-space: pre-wrap;
}

.acoes-linha {
  display: flex;
  gap: 16px;
  font-size: 14px;
}

.field select,
.field textarea {
  font: inherit;
}
</style>
