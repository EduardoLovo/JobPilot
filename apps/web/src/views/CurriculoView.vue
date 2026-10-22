<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@/services/api'
import { CURRICULO_MAX, curriculosService, type Curriculo } from '@/services/curriculos'

const curriculos = ref<Curriculo[]>([])
const carregando = ref(true)
const erro = ref('')

const editandoId = ref<string | null>(null)
const texto = ref('')
const tornarAtivo = ref(true)
const erroTexto = ref('')
const enviando = ref(false)

const ativo = computed(() => curriculos.value.find((c) => c.ativo) ?? null)
const anteriores = computed(() => curriculos.value.filter((c) => !c.ativo))

const titulo = computed(() => {
  if (editandoId.value) return 'Editar currículo'
  return curriculos.value.length ? 'Novo currículo' : 'Salvar seu currículo'
})

const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const previa = (conteudo: string) =>
  conteudo.length > 140 ? `${conteudo.slice(0, 140).trimEnd()}…` : conteudo

// Erro da API traz a própria mensagem; qualquer outro (rede fora do ar) vira um aviso genérico
const mensagemDe = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'

async function carregar() {
  try {
    curriculos.value = await curriculosService.list()
  } catch (e) {
    erro.value = mensagemDe(e)
  } finally {
    carregando.value = false
  }
}

function limparFormulario() {
  editandoId.value = null
  texto.value = ''
  tornarAtivo.value = true
  erroTexto.value = ''
}

function editar(curriculo: Curriculo) {
  editandoId.value = curriculo.id
  texto.value = curriculo.conteudo
  erroTexto.value = ''
}

async function salvar() {
  erro.value = ''
  erroTexto.value = ''
  enviando.value = true
  try {
    if (editandoId.value) {
      await curriculosService.update(editandoId.value, { conteudo: texto.value })
    } else {
      await curriculosService.create({ conteudo: texto.value, ativo: tornarAtivo.value })
    }
    limparFormulario()
    // Recarrega a lista: criar ou ativar um currículo muda qual está ativo
    await carregar()
  } catch (e) {
    const detalhe = e instanceof ApiError ? e.detalhes.find((d) => d.campo === 'conteudo') : null
    if (detalhe) erroTexto.value = detalhe.mensagem
    else erro.value = mensagemDe(e)
  } finally {
    enviando.value = false
  }
}

async function ativar(curriculo: Curriculo) {
  erro.value = ''
  try {
    await curriculosService.activate(curriculo.id)
    await carregar()
  } catch (e) {
    erro.value = mensagemDe(e)
  }
}

async function remover(curriculo: Curriculo) {
  const aviso =
    'Remover este currículo? As análises de vagas feitas com ele também serão removidas.'
  if (!window.confirm(aviso)) return

  erro.value = ''
  try {
    await curriculosService.remove(curriculo.id)
    if (editandoId.value === curriculo.id) limparFormulario()
    await carregar()
  } catch (e) {
    erro.value = mensagemDe(e)
  }
}

onMounted(carregar)
</script>

<template>
  <h1>Currículo</h1>
  <p class="subtitulo">
    Cole o texto do seu currículo. A análise de compatibilidade com as vagas usa o currículo ativo.
  </p>

  <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

  <p v-if="carregando" class="vazio">Carregando...</p>

  <template v-else>
    <section v-if="ativo" class="bloco" data-test="ativo">
      <header class="bloco-topo">
        <h2>Currículo ativo</h2>
        <span class="tag tag-status">Salvo em {{ formatarData(ativo.criadoEm) }}</span>
      </header>
      <pre class="texto" data-test="ativo-texto">{{ ativo.conteudo }}</pre>
      <div class="acoes-linha">
        <button class="btn-link" type="button" data-test="editar-ativo" @click="editar(ativo)">
          Editar
        </button>
        <button
          v-if="curriculos.length === 1"
          class="btn-link btn-perigo"
          type="button"
          data-test="remover-ativo"
          @click="remover(ativo)"
        >
          Remover
        </button>
      </div>
    </section>

    <section class="bloco">
      <h2>{{ titulo }}</h2>
      <form novalidate @submit.prevent="salvar">
        <label class="field">
          <span>Texto do currículo</span>
          <textarea
            v-model="texto"
            rows="12"
            :maxlength="CURRICULO_MAX"
            placeholder="Cole aqui o texto do seu currículo"
            data-test="texto"
          />
          <small v-if="erroTexto" class="field-erro" data-test="erro-texto">{{ erroTexto }}</small>
          <small v-else class="field-dica"
            >{{ texto.length }} / {{ CURRICULO_MAX }} caracteres</small
          >
        </label>

        <label v-if="!editandoId && curriculos.length" class="opcao">
          <input v-model="tornarAtivo" type="checkbox" data-test="tornar-ativo" />
          Usar como currículo ativo
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
          <button class="btn btn-auto" type="submit" :disabled="enviando" data-test="salvar">
            {{ enviando ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="anteriores.length" class="bloco" data-test="anteriores">
      <h2>Outros currículos</h2>
      <ul class="lista-curriculos">
        <li v-for="curriculo in anteriores" :key="curriculo.id" data-test="anterior">
          <div>
            <p class="data">Salvo em {{ formatarData(curriculo.criadoEm) }}</p>
            <p class="previa">{{ previa(curriculo.conteudo) }}</p>
          </div>
          <div class="acoes-linha">
            <button class="btn-link" type="button" data-test="ativar" @click="ativar(curriculo)">
              Ativar
            </button>
            <button class="btn-link" type="button" data-test="editar" @click="editar(curriculo)">
              Editar
            </button>
            <button
              class="btn-link btn-perigo"
              type="button"
              data-test="remover"
              @click="remover(curriculo)"
            >
              Remover
            </button>
          </div>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
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

.bloco-topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.bloco-topo h2 {
  margin: 0;
}

.texto {
  max-height: 240px;
  margin: 8px 0;
  padding: 12px;
  overflow: auto;
  font: inherit;
  font-size: 14px;
  white-space: pre-wrap;
  background: var(--cor-fundo);
  border-radius: 8px;
}

.acoes-linha {
  display: flex;
  gap: 16px;
}

.opcao {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.lista-curriculos {
  display: grid;
  gap: 12px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.lista-curriculos li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--cor-borda);
}

.lista-curriculos li:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.data,
.previa {
  margin: 0 0 4px;
  font-size: 14px;
}

.data {
  color: var(--cor-suave);
}
</style>
