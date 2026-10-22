import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '@/views/HomeView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    // Só para quem está logado
    requiresAuth?: boolean
    // Só para quem NÃO está logado (login, cadastro)
    guestOnly?: boolean
  }
}

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
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
