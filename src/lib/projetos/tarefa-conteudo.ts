const CABECALHO_CONTEUDO = "[MAKERSHUB:TAREFA:V1]";
const MARCADOR_DESCRICAO = "[DESCRICAO]";
const MARCADOR_ANOTACOES = "[ANOTACOES]";

export type ConteudoTarefa = {
  descricao: string;
  anotacoes: string;
};

export function separarConteudoTarefa(conteudo?: string | null): ConteudoTarefa {
  const texto = conteudo?.trim() ?? "";

  if (!texto.startsWith(`${CABECALHO_CONTEUDO}\n${MARCADOR_DESCRICAO}\n`)) {
    return { descricao: texto, anotacoes: "" };
  }

  const inicioDescricao = `${CABECALHO_CONTEUDO}\n${MARCADOR_DESCRICAO}\n`.length;
  const separadorAnotacoes = `\n${MARCADOR_ANOTACOES}\n`;
  const indiceAnotacoes = texto.indexOf(separadorAnotacoes, inicioDescricao);

  if (indiceAnotacoes === -1) {
    return { descricao: texto, anotacoes: "" };
  }

  return {
    descricao: texto.slice(inicioDescricao, indiceAnotacoes).trim(),
    anotacoes: texto.slice(indiceAnotacoes + separadorAnotacoes.length).trim(),
  };
}

export function juntarConteudoTarefa({ descricao, anotacoes }: ConteudoTarefa): string {
  const resumo = descricao.trim();
  const textoLongo = anotacoes.trim();

  if (!textoLongo) return resumo;

  return [CABECALHO_CONTEUDO, MARCADOR_DESCRICAO, resumo, MARCADOR_ANOTACOES, textoLongo].join(
    "\n",
  );
}
