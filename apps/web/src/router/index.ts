import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    // Só para quem está logado
    requiresAuth?: boolean
    // Só para quem NÃO está logado (login, cadastro)
    guestOnly?: boolean
  }
}

export const routes: RouteRecordRaw[] = [
  // A página inicial é o kanban das candidaturas
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/KanbanView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/candidaturas/:id',
    name: 'candidatura',
    component: () => import('@/views/CandidaturaView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/curriculo',
    name: 'curriculo',
    component: () => import('@/views/CurriculoView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vagas',
    name: 'vagas',
    component: () => import('@/views/VagasView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vagas/nova',
    name: 'vaga-nova',
    component: () => import('@/views/VagaFormView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vagas/:id/editar',
    name: 'vaga-editar',
    component: () => import('@/views/VagaFormView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/cadastro',
    name: 'cadastro',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true },
  },
]

export function installGuards(router: Router) {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()

    if (to.meta.guestOnly && auth.isAuthenticated) return { name: 'home' }

    if (to.meta.requiresAuth) {
      if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }

      try {
        await auth.loadUsuario()
      } catch {
        // Token inválido e sem refresh possível: volta para o login
        auth.logout()
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    }
  })
}

const router = createRouter({ history: createWebHistory(), routes })
installGuards(router)

export default router
