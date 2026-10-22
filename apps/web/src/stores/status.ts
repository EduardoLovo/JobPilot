import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API_URL } from '@/services/api'

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
