import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { PAISES, PAIS_PADRAO, limitarNacional, paisPorCodigo } from "@/lib/telefone-internacional";
import { cn } from "@/lib/utils";

interface Props {
  /** Código ISO do país selecionado. */
  pais: string;
  onPaisChange: (code: string) => void;
  /** Número nacional, já mascarado quando o país é BR. */
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Telefone com seletor de DDI. Abre no Brasil por padrão.
 *
 * O seletor é um combobox com busca porque uma lista de ~60 países num select
 * nativo obriga o visitante a rolar procurando. Digitar "por" e achar Portugal
 * é a diferença entre completar e abandonar o checkout.
 */
export function PhoneInputInternacional({
  pais,
  onPaisChange,
  value,
  onValueChange,
  className,
  disabled,
  id,
}: Props) {
  const [aberto, setAberto] = React.useState(false);
  const selecionado = paisPorCodigo(pais) ?? paisPorCodigo(PAIS_PADRAO)!;

  const trocarPais = (code: string) => {
    onPaisChange(code);
    setAberto(false);
    // Reaplica o limite/máscara do novo país sobre o que já estava digitado:
    // sair do Brasil precisa tirar os parênteses, entrar precisa pô-los.
    onValueChange(limitarNacional(value, code));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`País: ${selecionado.nome}. Trocar`}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors hover:bg-white/5 focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-base leading-none">{selecionado.flag}</span>
            <span className="tabular-nums">+{selecionado.ddi}</span>
            <ChevronDown className="size-3.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-0">
          <Command
            filter={(valor, busca) => (valor.toLowerCase().includes(busca.toLowerCase()) ? 1 : 0)}
          >
            <CommandInput placeholder="Buscar país ou código..." />
            <CommandList>
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {PAISES.map((p) => (
                  <CommandItem
                    key={p.code}
                    // O value alimenta a busca: nome, ISO e DDI juntos, então
                    // "portugal", "PT" e "351" acham o mesmo item.
                    value={`${p.nome} ${p.code} ${p.ddi}`}
                    onSelect={() => trocarPais(p.code)}
                  >
                    <span className="mr-2 text-base leading-none">{p.flag}</span>
                    <span className="flex-1 truncate">{p.nome}</span>
                    <span className="ml-2 tabular-nums text-muted-foreground">+{p.ddi}</span>
                    {p.code === pais && <Check className="ml-2 size-4 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        value={value}
        onChange={(e) => onValueChange(limitarNacional(e.target.value, pais))}
        placeholder={pais === PAIS_PADRAO ? "(11) 99999-8888" : "Número sem o código do país"}
        className="flex-1"
      />
    </div>
  );
}
