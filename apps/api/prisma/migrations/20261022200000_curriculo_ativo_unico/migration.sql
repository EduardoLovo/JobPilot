-- Cada pessoa tem no máximo um currículo ativo. É um índice único parcial (só vale para as linhas
-- com ativo = true), que o Prisma não consegue descrever no schema.prisma; por isso ele vive só aqui.
CREATE UNIQUE INDEX "curriculos_usuario_id_ativo_key" ON "curriculos"("usuario_id") WHERE "ativo" = true;
