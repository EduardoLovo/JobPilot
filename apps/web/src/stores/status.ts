import { defineStore } from 'pinia'
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export const useStatusStore = defineStore('status', () => {
  const apiOnline = ref<boolean | null>(null)

  async function checkApi() {
    try {
      const res = await fetch(`${API_URL}/health`)
      apiOnline.value = res.ok
    } catch {
      apiOnline.value = false
    }
  }

  return { apiOnline, checkApi }
})
