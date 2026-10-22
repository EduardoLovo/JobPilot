import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setOnSessionExpired } from './services/api'
import { useAuthStore } from './stores/auth'

const app = createApp(App).use(createPinia()).use(router)

// Se a sessão expirar no meio do uso, limpa o estado e manda para o login
setOnSessionExpired(() => {
  useAuthStore().logout()
  router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
})

app.mount('#app')
