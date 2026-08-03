import { z } from "zod";

// Dados puros de propósito: este módulo é importado tanto pelo widget quanto
// pela server function. Nada de React nem de ícone aqui — um import de
// iconsax-react arrastaria a lib inteira para o bundle do servidor.

export const MOTIVOS_SUPORTE = [
  { value: "bug", label: "Encontrei um erro / algo quebrou" },
  { value: "duvida", label: "Não entendi como usar" },
  { value: "dados", label: "Dados errados ou que sumiram" },
  { value: "lentidao", label: "Está lento ou travando" },
  { value: "portal", label: "Problema no portal do cliente" },
  { value: "cobranca", label: "Cobrança, plano ou pagamento" },
  { value: "sugestao", label: "Sugestão de melhoria" },
  { value: "outro", label: "Outro assunto" },
] as const;

export type MotivoSuporte = (typeof MOTIVOS_SUPORTE)[number]["value"];

const VALORES = MOTIVOS_SUPORTE.map((m) => m.value) as [MotivoSuporte, ...MotivoSuporte[]];

export const motivoSchema = z.enum(VALORES);

export function labelDoMotivo(valor: MotivoSuporte): string {
  return MOTIVOS_SUPORTE.find((m) => m.value === valor)?.label ?? valor;
}
