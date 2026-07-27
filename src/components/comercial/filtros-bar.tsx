/* eslint-disable react-refresh/only-export-components -- filtros compartilhados pela lista e pelo Kanban */
import { useMemo } from "react";
import { SearchNormal, CloseCircle } from "iconsax-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  useComercial,
  useEtapasComercial,
  type Temperatura,
  type EtapaJornada,
  getEmpresa,
  getContato,
} from "@/lib/hooks/useComercial";

export interface FiltroState {
  busca: string;
  responsavel: string;
  origem: string;
  etapa: EtapaJornada | "todas";
  temperatura: Temperatura | "todas";
  cidade: string;
  segmento: string;
}

export const filtroInicial: FiltroState = {
  busca: "",
  responsavel: "todos",
  origem: "todas",
  etapa: "todas",
  temperatura: "todas",
  cidade: "todas",
  segmento: "todas",
};

export function aplicarFiltro(leads: import("@/lib/hooks/useComercial").Lead[], f: FiltroState) {
  const q = f.busca.trim().toLowerCase();
  return leads.filter((l) => {
    if (f.responsavel !== "todos" && l.responsavel !== f.responsavel) return false;
    if (f.origem !== "todas" && l.origem !== f.origem) return false;
    if (f.etapa !== "todas" && l.etapa !== f.etapa) return false;
    if (f.temperatura !== "todas" && l.temperatura !== f.temperatura) return false;
    const emp = getEmpresa(l.empresaId);
    const ct = getContato(l.contatoId);
    if (f.cidade !== "todas" && emp?.cidade !== f.cidade) return false;
    if (f.segmento !== "todas" && emp?.segmento !== f.segmento) return false;
    if (!q) return true;
    return (
      emp?.nome.toLowerCase().includes(q) ||
      ct?.nome.toLowerCase().includes(q) ||
      ct?.email.toLowerCase().includes(q) ||
      ct?.telefone.toLowerCase().includes(q) ||
      l.responsavel.toLowerCase().includes(q)
    );
  });
}

export function FiltrosBar({
  value,
  onChange,
}: {
  value: FiltroState;
  onChange: (v: FiltroState) => void;
}) {
  const leads = useComercial((s) => s.leads);
  const empresas = useComercial((s) => s.empresas);
  const etapas = useEtapasComercial();
  const responsaveis = useMemo(() => Array.from(new Set(leads.map((l) => l.responsavel))), [leads]);
  const origens = useMemo(() => Array.from(new Set(leads.map((l) => l.origem))), [leads]);
  const cidades = useMemo(() => Array.from(new Set(empresas.map((e) => e.cidade))), [empresas]);
  const segmentos = useMemo(() => Array.from(new Set(empresas.map((e) => e.segmento))), [empresas]);

  const sujo = JSON.stringify(value) !== JSON.stringify(filtroInicial);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[260px] flex-1">
        <SearchNormal
          size={14}
          color="currentColor"
          variant="Linear"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary"
        />
        <Input
          placeholder="Buscar empresa, contato, e-mail, telefone…"
          className="h-9 pl-9"
          value={value.busca}
          onChange={(e) => onChange({ ...value, busca: e.target.value })}
        />
      </div>
      <Sel
        label="Responsável"
        value={value.responsavel}
        onChange={(v) => onChange({ ...value, responsavel: v })}
        options={[["todos", "Todos"], ...responsaveis.map((r) => [r, r] as [string, string])]}
      />
      <Sel
        label="Origem"
        value={value.origem}
        onChange={(v) => onChange({ ...value, origem: v })}
        options={[["todas", "Todas"], ...origens.map((r) => [r, r] as [string, string])]}
      />
      <Sel
        label="Etapa"
        value={value.etapa}
        onChange={(v) => onChange({ ...value, etapa: v as EtapaJornada | "todas" })}
        options={[["todas", "Todas"], ...etapas.map((e) => [e.id, e.label] as [string, string])]}
      />
      <Sel
        label="Temperatura"
        value={value.temperatura}
        onChange={(v) => onChange({ ...value, temperatura: v as Temperatura | "todas" })}
        options={[
          ["todas", "Todas"],
          ["frio", "Frio"],
          ["morno", "Morno"],
          ["quente", "Quente"],
        ]}
      />
      <Sel
        label="Cidade"
        value={value.cidade}
        onChange={(v) => onChange({ ...value, cidade: v })}
        options={[["todas", "Todas"], ...cidades.map((r) => [r, r] as [string, string])]}
      />
      <Sel
        label="Segmento"
        value={value.segmento}
        onChange={(v) => onChange({ ...value, segmento: v })}
        options={[["todas", "Todos"], ...segmentos.map((r) => [r, r] as [string, string])]}
      />
      {sujo && (
        <Button
          size="sm"
          variant="ghost"
          className="h-9 gap-1 text-xs"
          onClick={() => onChange(filtroInicial)}
        >
          <CloseCircle size={12} color="currentColor" variant="Linear" className="text-primary" />{" "}
          Limpar
        </Button>
      )}
    </div>
  );
}

function Sel({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1.5 text-xs">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v} className="text-xs">
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
