import { ETAPAS, type EtapaJornada } from "@/lib/mock/comercial";

export type LabelsEtapasComercial = Partial<Record<EtapaJornada, string>>;

const IDS_ETAPAS = new Set<EtapaJornada>(ETAPAS.map((etapa) => etapa.id));

export function normalizarLabelsEtapas(valor: unknown): LabelsEtapasComercial {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  return Object.fromEntries(
    Object.entries(valor).flatMap(([id, label]) => {
      if (!IDS_ETAPAS.has(id as EtapaJornada) || typeof label !== "string") return [];
      const texto = label.trim().slice(0, 40);
      return texto ? [[id, texto]] : [];
    }),
  ) as LabelsEtapasComercial;
}

export function etapasComLabels(labels: LabelsEtapasComercial) {
  return ETAPAS.map((etapa) => ({ ...etapa, label: labels[etapa.id] ?? etapa.label }));
}
