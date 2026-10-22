const dois = (n: number) => String(n).padStart(2, '0')

// A API guarda e devolve instantes em UTC; a tela mostra e edita no fuso de quem está usando.

// "2026-11-05T17:00:00.000Z" vira "2026-11-05T14:00" (valor de <input type="datetime-local">)
export function paraCampoLocal(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`
}

// O caminho de volta: "2026-11-05T14:00" (hora local) vira o instante em UTC. Vazio ou inválido: null.
export function deCampoLocal(valor: string) {
  const d = new Date(valor)
  return valor && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}

export const agoraNoCampoLocal = () => paraCampoLocal(new Date().toISOString())

export const formatarDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
