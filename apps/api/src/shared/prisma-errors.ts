// P2002 é o código do Prisma para violação de índice único. Duas requisições simultâneas passam
// juntas pela checagem feita em código e uma delas cai no índice do banco.
export const violouUnicidade = (erro: unknown) =>
  typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2002'
