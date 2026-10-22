-- CreateEnum
CREATE TYPE "status_candidatura" AS ENUM ('INTERESSE', 'APLICADO', 'ENTREVISTA', 'OFERTA', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "tipo_etapa" AS ENUM ('TRIAGEM', 'ENTREVISTA_RH', 'ENTREVISTA_TECNICA', 'TESTE_TECNICO', 'PROPOSTA', 'OUTRO');

-- CreateEnum
CREATE TYPE "modalidade" AS ENUM ('REMOTO', 'HIBRIDO', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "senioridade" AS ENUM ('ESTAGIO', 'JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "site" TEXT,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vagas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "url" TEXT,
    "modalidade" "modalidade",
    "senioridade" "senioridade",
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidaturas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "vaga_id" UUID NOT NULL,
    "status" "status_candidatura" NOT NULL DEFAULT 'INTERESSE',
    "data_aplicacao" DATE,
    "proximo_followup" DATE,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etapas" (
    "id" UUID NOT NULL,
    "candidatura_id" UUID NOT NULL,
    "tipo" "tipo_etapa" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "anotacoes" TEXT,

    CONSTRAINT "etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analises_ia" (
    "id" UUID NOT NULL,
    "candidatura_id" UUID NOT NULL,
    "curriculo_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "palavras_faltando" JSONB NOT NULL,
    "recomendacoes" TEXT NOT NULL,
    "gerada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analises_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "curriculos_usuario_id_idx" ON "curriculos"("usuario_id");

-- CreateIndex
CREATE INDEX "vagas_empresa_id_idx" ON "vagas"("empresa_id");

-- CreateIndex
CREATE INDEX "candidaturas_usuario_id_status_idx" ON "candidaturas"("usuario_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidaturas_usuario_id_vaga_id_key" ON "candidaturas"("usuario_id", "vaga_id");

-- CreateIndex
CREATE INDEX "etapas_candidatura_id_idx" ON "etapas"("candidatura_id");

-- CreateIndex
CREATE UNIQUE INDEX "analises_ia_candidatura_id_key" ON "analises_ia"("candidatura_id");

-- CreateIndex
CREATE INDEX "analises_ia_curriculo_id_idx" ON "analises_ia"("curriculo_id");

-- AddForeignKey
ALTER TABLE "curriculos" ADD CONSTRAINT "curriculos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vagas" ADD CONSTRAINT "vagas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidaturas" ADD CONSTRAINT "candidaturas_vaga_id_fkey" FOREIGN KEY ("vaga_id") REFERENCES "vagas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etapas" ADD CONSTRAINT "etapas_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises_ia" ADD CONSTRAINT "analises_ia_candidatura_id_fkey" FOREIGN KEY ("candidatura_id") REFERENCES "candidaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises_ia" ADD CONSTRAINT "analises_ia_curriculo_id_fkey" FOREIGN KEY ("curriculo_id") REFERENCES "curriculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
