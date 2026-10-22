-- DropForeignKey
ALTER TABLE "analises_ia" DROP CONSTRAINT "analises_ia_curriculo_id_fkey";

-- AddForeignKey
ALTER TABLE "analises_ia" ADD CONSTRAINT "analises_ia_curriculo_id_fkey" FOREIGN KEY ("curriculo_id") REFERENCES "curriculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
