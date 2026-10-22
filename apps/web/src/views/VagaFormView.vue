<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/services/api'
import {
  MODALIDADES,
  SENIORIDADES,
  empresasService,
  vagasService,
  type Empresa,
  type Modalidade,
  type Senioridade,
} from '@/services/vagas'

const NOVA_EMPRESA = '__nova__'

const route = useRoute()
const router = useRouter()

const vagaId = computed(() => (route.params.id as string | undefined) ?? null)
const editando = computed(() => vagaId.value !== null)

const empresas = ref<Empresa[]>([])
const carregando = ref(true)
const enviando = ref(false)
const erro = ref('')
const errosCampo = ref<Record<string, string>>({})

const form = reactive({
  empresaId: '',
  novaEmpresa: '',
  titulo: '',
  descricao: '',
  url: '',
  modalidade: '' as Modalidade | '',
  senioridade: '' as Senioridade | '',
})

onMounted(async () => {
  try {
    empresas.value = await empresasService.list()

    if (vagaId.value) {
      const vaga = await vagasService.get(vagaId.value)
      Object.assign(form, {
        empresaId: vaga.empresaId,
        titulo: vaga.titulo,
        descricao: vaga.descricao,
        url: vaga.url ?? '',
        modalidade: vaga.modalidade ?? '',
        senioridade: vaga.senioridade ?? '',
      })
    } else if (!empresas.value.length) {
      // Primeira vaga: ainda não há empresas, então já abre o campo para cadastrar uma
      form.empresaId = NOVA_EMPRESA
    }
  } catch (e) {
    erro.value = e instanceof ApiError ? e.message : 'Não foi possível conectar à API.'
  } finally {
    carregando.value = false
  }
})

async function salvar() {
  erro.value = ''
  errosCampo.value = {}

  if (form.empresaId === NOVA_EMPRESA && form.novaEmpresa.trim().length < 2) {
    errosCampo.value = { novaEmpresa: 'Informe o nome da empresa' }
    return
  }
  if (!form.empresaId) {
    errosCampo.value = { empresaId: 'Escolha uma empresa' }
    return
  }

  enviando.value = true
  try {
    const empresaId =
      form.empresaId === NOVA_EMPRESA
        ? (await empresasService.create({ nome: form.novaEmpresa })).id
        : form.empresaId

    const dados = {
      empresaId,
      titulo: form.titulo,
      descricao: form.descricao,
      url: form.url.trim() || null,
      modalidade: form.modalidade || null,
      senioridade: form.senioridade || null,
    }

    if (vagaId.value) await vagasService.update(vagaId.value, dados)
    else await vagasService.create(dados)

    await router.push({ name: 'vagas' })
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
  <section class="form-card">
    <h1>{{ editando ? 'Editar vaga' : 'Nova vaga' }}</h1>

    <p v-if="carregando" class="vazio">Carregando...</p>

    <form v-else novalidate @submit.prevent="salvar">
      <label class="field">
        <span>Empresa</span>
        <select v-model="form.empresaId" data-test="empresa">
          <option value="" disabled>Selecione...</option>
          <option v-for="empresa in empresas" :key="empresa.id" :value="empresa.id">
            {{ empresa.nome }}
          </option>
          <option :value="NOVA_EMPRESA">+ Cadastrar nova empresa</option>
        </select>
        <small v-if="errosCampo.empresaId" class="field-erro">{{ errosCampo.empresaId }}</small>
      </label>

      <label v-if="form.empresaId === NOVA_EMPRESA" class="field">
        <span>Nome da nova empresa</span>
        <input v-model="form.novaEmpresa" data-test="nova-empresa" />
        <small v-if="errosCampo.novaEmpresa" class="field-erro">{{ errosCampo.novaEmpresa }}</small>
      </label>

      <label class="field">
        <span>Título</span>
        <input v-model="form.titulo" data-test="titulo" />
        <small v-if="errosCampo.titulo" class="field-erro">{{ errosCampo.titulo }}</small>
      </label>

      <label class="field">
        <span>Descrição</span>
        <textarea v-model="form.descricao" rows="6" data-test="descricao" />
        <small v-if="errosCampo.descricao" class="field-erro">{{ errosCampo.descricao }}</small>
      </label>

      <label class="field">
        <span>Link do anúncio (opcional)</span>
        <input v-model="form.url" type="url" placeholder="https://" />
        <small v-if="errosCampo.url" class="field-erro">{{ errosCampo.url }}</small>
      </label>

      <div class="duas-colunas">
        <label class="field">
          <span>Modalidade</span>
          <select v-model="form.modalidade">
            <option value="">Não informada</option>
            <option v-for="(rotulo, valor) in MODALIDADES" :key="valor" :value="valor">
              {{ rotulo }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Senioridade</span>
          <select v-model="form.senioridade">
            <option value="">Não informada</option>
            <option v-for="(rotulo, valor) in SENIORIDADES" :key="valor" :value="valor">
              {{ rotulo }}
            </option>
          </select>
        </label>
      </div>

      <p v-if="erro" class="alert" role="alert" data-test="erro">{{ erro }}</p>

      <div class="botoes">
        <RouterLink :to="{ name: 'vagas' }">Cancelar</RouterLink>
        <button class="btn btn-auto" type="submit" :disabled="enviando">
          {{ enviando ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </form>
  </section>
</template>
