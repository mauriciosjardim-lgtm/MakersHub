/**
 * MakersHub MCP — servidor remoto + OAuth (Cloudflare Worker)
 * ============================================================================
 * Expõe as ferramentas do CRM MakersHub para o Claude de cada produtora.
 *
 * Dois jeitos de conectar:
 *  1) Token fixo (Claude Code):  Authorization: Bearer nvn_...
 *  2) OAuth (Claude Desktop):    o cliente clica "adicionar conector", faz
 *     login no MakersHub e autoriza — sem copiar token nenhum.
 *
 * O OAuth aqui é "sem estado": os códigos e client_ids são tokens HMAC
 * assinados (não precisa de KV/banco extra). No fim do login, geramos um
 * token nvn_ normal (hash salvo em mcp_tokens) e ele VIRA o access_token do
 * OAuth — então o endpoint MCP continua idêntico (valida o nvn_ via hash).
 *
 * Segurança: nenhuma service role key. As funções SECURITY DEFINER no Postgres
 * validam o token e resolvem a empresa.
 * ============================================================================
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  OAUTH_SIGNING_KEY: string; // segredo p/ assinar códigos OAuth (wrangler secret)
}

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "makershub", version: "7.0.0" };
const CODE_TTL_SECONDS = 600; // código de autorização válido por 10 min

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, WWW-Authenticate",
};

// ─── Ferramentas (JSON Schema p/ o cliente) ─────────────────────────────────
const TOOLS = [
  {
    name: "criar_lead",
    description:
      "Cria uma nova oportunidade (lead) no CRM MakersHub da produtora. Use ao encontrar um possível cliente para a produtora de audiovisual.",
    inputSchema: {
      type: "object",
      properties: {
        empresa: { type: "string", description: "Nome da empresa/cliente do lead (ex: 'Padaria Pão Quente')" },
        contato: { type: "string", description: "Nome da pessoa de contato (ex: 'João Silva')" },
        email: { type: "string", description: "E-mail do contato" },
        telefone: { type: "string", description: "Telefone do contato" },
        valor: { type: "number", description: "Valor estimado da oportunidade em reais" },
        origem: { type: "string", description: "Origem do lead (ex: 'Instagram', 'Indicação')" },
        temperatura: { type: "string", enum: ["frio", "morno", "quente"], description: "Temperatura do lead" },
        segmento: { type: "string", description: "Segmento do cliente (ex: 'Gastronomia')" },
        cidade: { type: "string", description: "Cidade do cliente" },
      },
      required: ["empresa", "contato"],
    },
  },
  {
    name: "listar_leads",
    description: "Lista os leads do funil comercial da produtora no MakersHub. Opcionalmente filtra por etapa.",
    inputSchema: {
      type: "object",
      properties: {
        etapa: {
          type: "string",
          enum: ["novo", "diagnostico", "reuniao", "proposta", "negociacao", "fechado", "perdido"],
          description: "Filtrar por uma etapa específica do funil (opcional)",
        },
      },
    },
  },
  {
    name: "mover_etapa",
    description: "Move um lead para outra etapa do funil comercial no MakersHub.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID do lead (obtido via listar_leads)" },
        etapa: {
          type: "string",
          enum: ["novo", "diagnostico", "reuniao", "proposta", "negociacao", "fechado", "perdido"],
          description: "Nova etapa do funil",
        },
      },
      required: ["lead_id", "etapa"],
    },
  },

  // ── Financeiro ──
  {
    name: "criar_lancamento",
    description: "Lança uma receita ou despesa no financeiro do MakersHub. Use para registrar entradas e saídas de dinheiro da produtora.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Tipo do lançamento" },
        categoria: { type: "string", description: "Categoria (ex: 'Edição', 'Equipamento', 'Salários')" },
        descricao: { type: "string", description: "Descrição do lançamento" },
        valor: { type: "number", description: "Valor em reais" },
        vencimento: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" },
        cliente: { type: "string", description: "Cliente associado (opcional)" },
        forma_pagamento: { type: "string", description: "Forma de pagamento (ex: 'PIX', 'Boleto') (opcional)" },
        observacoes: { type: "string", description: "Observações (opcional)" },
        pago: { type: "boolean", description: "Se já foi pago/recebido (default false)" },
        carteira_id: { type: "string", description: "ID da carteira (obtido via listar_carteiras) (opcional)" },
        projeto_id: { type: "string", description: "ID do projeto a vincular (obtido via listar_projetos) (opcional)" },
      },
      required: ["tipo", "descricao", "valor", "vencimento"],
    },
  },
  {
    name: "listar_lancamentos",
    description: "Lista os lançamentos financeiros do MakersHub. Filtra opcionalmente por tipo, status e carteira.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["receita", "despesa"], description: "Filtrar por tipo (opcional)" },
        status: { type: "string", enum: ["previsto", "recebido", "pago", "atrasado"], description: "Filtrar por status (opcional)" },
        carteira_id: { type: "string", description: "Filtrar por carteira (opcional)" },
      },
    },
  },
  {
    name: "marcar_pago",
    description: "Marca um lançamento financeiro como pago (despesa) ou recebido (receita), na data de hoje.",
    inputSchema: {
      type: "object",
      properties: { lancamento_id: { type: "string", description: "ID do lançamento (obtido via listar_lancamentos)" } },
      required: ["lancamento_id"],
    },
  },
  {
    name: "resumo_financeiro",
    description: "Retorna um resumo financeiro: a receber, a pagar, atrasados e saldo do mês. Por padrão considera só a conta da EMPRESA (lançamentos sem carteira). Passe 'carteira' com o nome ou ID de uma carteira para o resumo dela, ou 'todas' para o total geral.",
    inputSchema: {
      type: "object",
      properties: {
        carteira: { type: "string", description: "Opcional. Nome ou ID de uma carteira específica, ou 'todas' para o total geral. Vazio = só a empresa." },
      },
    },
  },

  // ── Importação / Demo ──
  {
    name: "importar_lancamentos",
    description: "Importa lançamentos financeiros em lote. Envie os dados como string JSON com um array de objetos. Cada item precisa de: tipo (receita|despesa), descricao, valor (número), vencimento (YYYY-MM-DD). Opcionais: categoria, carteira (nome ou id), cliente, pago (boolean).",
    inputSchema: {
      type: "object",
      properties: {
        dados: {
          type: "string",
          description: 'String JSON com array de lançamentos. Exemplo: [{"tipo":"receita","descricao":"Projeto X","valor":5000,"vencimento":"2026-06-20","pago":true}]',
        },
      },
      required: ["dados"],
    },
  },
  {
    name: "criar_cenario_demo_financeiro",
    description: "Popula o financeiro com lançamentos realistas pré-definidos. Use nome='videomaker_10k' para cenário de produtora audiovisual com ~20 lançamentos (receitas de projetos, despesas de equipe/software/impostos, mix de status). Ideal para demos.",
    inputSchema: {
      type: "object",
      properties: {
        nome:              { type: "string", description: "Nome do cenário: 'videomaker_10k' (default)", enum: ["videomaker_10k"] },
        limpar_existentes: { type: "boolean", description: "Se true, apaga todos os lançamentos antes de criar o cenário (default false)" },
      },
    },
  },

  {
    name: "limpar_financeiro",
    description: "Apaga TODOS os lançamentos financeiros da empresa. Use antes de importar_lancamentos ou criar_cenario_demo_financeiro para começar do zero. Ação irreversível.",
    inputSchema: {
      type: "object",
      properties: {
        confirmar: { type: "boolean", description: "Deve ser true para confirmar a exclusão de todos os lançamentos" },
      },
      required: ["confirmar"],
    },
  },

  // ── Carteiras ──
  {
    name: "listar_carteiras",
    description: "Lista as carteiras financeiras do MakersHub (ex: Conta PJ, Pessoal, Caixa). Use para obter IDs ao lançar ou filtrar lançamentos por carteira.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "criar_carteira",
    description: "Cria uma nova carteira financeira no MakersHub (conta bancária, caixa, cartão, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome da carteira (ex: 'Conta PJ Bradesco', 'Caixa físico')" },
        tipo: { type: "string", enum: ["pj", "pf", "dinheiro", "cartao", "outro"], description: "Tipo: pj (empresa), pf (pessoal), dinheiro, cartao ou outro (default: outro)" },
      },
      required: ["nome"],
    },
  },
  {
    name: "excluir_carteira",
    description: "Exclui uma carteira financeira. Os lançamentos vinculados a ela voltam para a empresa (ficam sem carteira). Use listar_carteiras para obter o ID.",
    inputSchema: {
      type: "object",
      properties: {
        carteira_id: { type: "string", description: "ID da carteira a excluir (obtido via listar_carteiras)" },
      },
      required: ["carteira_id"],
    },
  },

  // ── Projetos ──
  {
    name: "criar_projeto",
    description: "Cria um novo projeto (produção audiovisual) no MakersHub.",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do projeto" },
        cliente: { type: "string", description: "Cliente do projeto" },
        descricao: { type: "string", description: "Descrição (opcional)" },
        valor: { type: "number", description: "Valor do projeto em reais (opcional)" },
        data_inicio: { type: "string", description: "Data de início (YYYY-MM-DD) (opcional)" },
        data_entrega: { type: "string", description: "Data de entrega (YYYY-MM-DD) (opcional)" },
      },
      required: ["nome", "cliente"],
    },
  },
  {
    name: "listar_projetos",
    description: "Lista os projetos da produtora no MakersHub (fase, progresso, valor, entrega).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "obter_projeto",
    description: "Abre o workspace completo de um projeto: dados, etapas, equipe, tarefas, marcos e entregáveis. Use antes de criar ou mover tarefas para conhecer o fluxo configurado.",
    inputSchema: { type: "object", properties: { projeto_id: { type: "string", description: "ID obtido em listar_projetos" } }, required: ["projeto_id"] },
  },
  {
    name: "criar_tarefa_projeto",
    description: "Cria uma ação concreta dentro de um projeto. O título descreve o que fazer; etapa indica onde ela está no fluxo de produção.",
    inputSchema: { type: "object", properties: {
      projeto_id: { type: "string" }, titulo: { type: "string", description: "Ação concreta, ex: Editar criativo Dia das Mães" },
      etapa: { type: "string", description: "Etapa do fluxo. Consulte obter_projeto para ver as etapas disponíveis." },
      responsavel: { type: "string" }, prazo: { type: "string", description: "ISO 8601 com fuso" },
      prioridade: { type: "string", enum: ["baixa","media","alta","urgente"] }, descricao: { type: "string" }, link: { type: "string" },
    }, required: ["projeto_id","titulo"] },
  },
  {
    name: "listar_tarefas_projeto",
    description: "Lista tarefas da operação. Pode filtrar por projeto, etapa e apenas pendentes; inclui projeto, cliente, cor, responsável e prazo.",
    inputSchema: { type: "object", properties: {
      projeto_id: { type: "string" }, etapa: { type: "string" }, apenas_pendentes: { type: "boolean" },
    } },
  },
  {
    name: "atualizar_tarefa_projeto",
    description: "Edita ou move uma tarefa entre etapas. O avanço do projeto é recalculado automaticamente.",
    inputSchema: { type: "object", properties: {
      tarefa_id: { type: "string" }, titulo: { type: "string" }, etapa: { type: "string" }, concluida: { type: "boolean" },
      responsavel: { type: "string" }, prazo: { type: "string", description: "ISO 8601 com fuso" },
      prioridade: { type: "string", enum: ["baixa","media","alta","urgente"] }, descricao: { type: "string" }, link: { type: "string" },
    }, required: ["tarefa_id"] },
  },
  {
    name: "concluir_tarefa_projeto",
    description: "Conclui uma tarefa do projeto, move para Concluída e recalcula o avanço da produção.",
    inputSchema: { type: "object", properties: { tarefa_id: { type: "string" } }, required: ["tarefa_id"] },
  },

  // ── Follow-ups ──
  {
    name: "criar_followup",
    description: "Cria uma tarefa de follow-up para um lead do funil comercial no MakersHub.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID do lead (obtido via listar_leads)" },
        titulo: { type: "string", description: "O que fazer (ex: 'Ligar para confirmar proposta')" },
        prazo: { type: "string", description: "Prazo (YYYY-MM-DD)" },
        responsavel: { type: "string", description: "Responsável (opcional)" },
      },
      required: ["lead_id", "titulo", "prazo"],
    },
  },

  // ── Agenda ──
  {
    name: "criar_evento",
    description: "Cria um evento na agenda do MakersHub (reunião, gravação, entrega, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título do evento" },
        inicio: { type: "string", description: "Início (ISO 8601, ex: 2026-06-20T14:00:00-03:00)" },
        fim: { type: "string", description: "Fim (ISO 8601)" },
        descricao: { type: "string", description: "Descrição (opcional)" },
        tipo: { type: "string", enum: ["reuniao", "gravacao", "entrega", "tarefa", "outro"], description: "Tipo do evento (opcional)" },
        local: { type: "string", description: "Local (opcional)" },
      },
      required: ["titulo", "inicio", "fim"],
    },
  },
  {
    name: "listar_eventos",
    description: "Lista eventos da agenda do MakersHub. Filtra opcionalmente por período (de/até).",
    inputSchema: {
      type: "object",
      properties: {
        de: { type: "string", description: "Início do período (ISO 8601) (opcional)" },
        ate: { type: "string", description: "Fim do período (ISO 8601) (opcional)" },
      },
    },
  },

  // ── Leads: editar / excluir ──
  {
    name: "atualizar_lead",
    description:
      "Edita um lead existente no CRM MakersHub. Use para enriquecer ou corrigir dados (valor, temperatura, origem, responsável) ou adicionar e-mail/telefone do contato. Só os campos enviados são alterados.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "ID do lead (obtido via listar_leads)" },
        valor: { type: "number", description: "Novo valor estimado em reais (opcional)" },
        temperatura: { type: "string", enum: ["frio", "morno", "quente"], description: "Nova temperatura (opcional)" },
        origem: { type: "string", description: "Nova origem (opcional)" },
        responsavel: { type: "string", description: "Novo responsável (opcional)" },
        email: { type: "string", description: "E-mail do contato principal — preenche/atualiza (opcional)" },
        telefone: { type: "string", description: "Telefone do contato principal — preenche/atualiza (opcional)" },
      },
      required: ["lead_id"],
    },
  },
  {
    name: "excluir_lead",
    description: "Exclui um lead do funil comercial do MakersHub (junto com sua timeline e follow-ups). Ação irreversível.",
    inputSchema: {
      type: "object",
      properties: { lead_id: { type: "string", description: "ID do lead (obtido via listar_leads)" } },
      required: ["lead_id"],
    },
  },

  // ── Follow-ups: listar / concluir ──
  {
    name: "listar_followups",
    description: "Lista os follow-ups (tarefas de lead) do MakersHub. Por padrão mostra só os pendentes.",
    inputSchema: {
      type: "object",
      properties: {
        apenas_pendentes: { type: "boolean", description: "Se true (padrão), oculta os já concluídos." },
      },
    },
  },
  {
    name: "concluir_followup",
    description: "Marca um follow-up (tarefa de lead) como concluído no MakersHub.",
    inputSchema: {
      type: "object",
      properties: { followup_id: { type: "string", description: "ID do follow-up (obtido via listar_followups)" } },
      required: ["followup_id"],
    },
  },

  // ── Financeiro: editar / excluir / desfazer ──
  {
    name: "atualizar_lancamento",
    description: "Edita um lançamento financeiro do MakersHub. Só os campos enviados são alterados; o status é recalculado pelo vencimento.",
    inputSchema: {
      type: "object",
      properties: {
        lancamento_id: { type: "string", description: "ID do lançamento (obtido via listar_lancamentos)" },
        descricao: { type: "string", description: "Nova descrição (opcional)" },
        valor: { type: "number", description: "Novo valor em reais (opcional)" },
        categoria: { type: "string", description: "Nova categoria (opcional)" },
        vencimento: { type: "string", description: "Novo vencimento (YYYY-MM-DD) (opcional)" },
        cliente: { type: "string", description: "Novo cliente (opcional)" },
        forma_pagamento: { type: "string", description: "Nova forma de pagamento (opcional)" },
        observacoes: { type: "string", description: "Novas observações (opcional)" },
        carteira_id: { type: "string", description: "Nova carteira (ID, obtido via listar_carteiras) (opcional)" },
      },
      required: ["lancamento_id"],
    },
  },
  {
    name: "excluir_lancamento",
    description: "Exclui um lançamento financeiro do MakersHub. Ação irreversível.",
    inputSchema: {
      type: "object",
      properties: { lancamento_id: { type: "string", description: "ID do lançamento (obtido via listar_lancamentos)" } },
      required: ["lancamento_id"],
    },
  },
  {
    name: "desfazer_pagamento",
    description: "Desfaz o pagamento/recebimento de um lançamento (volta para previsto ou atrasado) no MakersHub.",
    inputSchema: {
      type: "object",
      properties: { lancamento_id: { type: "string", description: "ID do lançamento (obtido via listar_lancamentos)" } },
      required: ["lancamento_id"],
    },
  },

  // ── Projetos: editar / excluir ──
  {
    name: "atualizar_projeto",
    description: "Edita um projeto do MakersHub (nome, cliente, fase, progresso, valor, entrega). Só os campos enviados são alterados.",
    inputSchema: {
      type: "object",
      properties: {
        projeto_id: { type: "string", description: "ID do projeto (obtido via listar_projetos)" },
        nome: { type: "string", description: "Novo nome (opcional)" },
        cliente: { type: "string", description: "Novo cliente (opcional)" },
        descricao: { type: "string", description: "Nova descrição (opcional)" },
        fase: {
          type: "string",
          enum: ["briefing", "pre_producao", "captacao", "edicao", "revisao", "entrega", "concluida"],
          description: "Nova fase do projeto (opcional)",
        },
        progresso: { type: "number", description: "Progresso de 0 a 100 (opcional)" },
        valor: { type: "number", description: "Novo valor em reais (opcional)" },
        data_entrega: { type: "string", description: "Nova data de entrega (YYYY-MM-DD) (opcional)" },
      },
      required: ["projeto_id"],
    },
  },
  {
    name: "excluir_projeto",
    description: "Exclui um projeto do MakersHub. Ação irreversível.",
    inputSchema: {
      type: "object",
      properties: { projeto_id: { type: "string", description: "ID do projeto (obtido via listar_projetos)" } },
      required: ["projeto_id"],
    },
  },

  // ── Agenda: editar / excluir ──
  {
    name: "atualizar_evento",
    description: "Edita um evento da agenda do MakersHub (título, horários, tipo, local). Só os campos enviados são alterados.",
    inputSchema: {
      type: "object",
      properties: {
        evento_id: { type: "string", description: "ID do evento (obtido via listar_eventos)" },
        titulo: { type: "string", description: "Novo título (opcional)" },
        inicio: { type: "string", description: "Novo início (ISO 8601) (opcional)" },
        fim: { type: "string", description: "Novo fim (ISO 8601) (opcional)" },
        descricao: { type: "string", description: "Nova descrição (opcional)" },
        tipo: { type: "string", enum: ["reuniao", "gravacao", "entrega", "tarefa", "outro"], description: "Novo tipo (opcional)" },
        local: { type: "string", description: "Novo local (opcional)" },
      },
      required: ["evento_id"],
    },
  },
  {
    name: "excluir_evento",
    description: "Exclui um evento da agenda do MakersHub. Ação irreversível.",
    inputSchema: {
      type: "object",
      properties: { evento_id: { type: "string", description: "ID do evento (obtido via listar_eventos)" } },
      required: ["evento_id"],
    },
  },
];

// ─── Utils cripto / base64url ────────────────────────────────────────────────
function b64urlFromBytes(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64urlJson(obj: unknown): string {
  return b64urlFromBytes(new TextEncoder().encode(JSON.stringify(obj)));
}
async function sha256Bytes(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}
async function sha256Hex(input: string): Promise<string> {
  return [...(await sha256Bytes(input))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}
/** Cria um token assinado: base64url(payload).base64url(hmac) */
async function signToken(secret: string, payload: object): Promise<string> {
  const key = await hmacKey(secret);
  const body = b64urlJson(payload);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64urlFromBytes(sig)}`;
}
/** Verifica e devolve o payload, ou null se inválido. */
async function verifyToken<T = any>(secret: string, token: string): Promise<T | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(body));
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as T;
  } catch {
    return null;
  }
}

function genNvnToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return "mkr_" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ─── Supabase (REST/Auth via fetch, só com a chave anon) ─────────────────────
async function callRpc(env: Env, fn: string, body: Record<string, unknown>, userJwt?: string): Promise<unknown> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt ?? env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase RPC ${fn} (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Login com e-mail/senha → devolve o JWT do usuário, ou null. */
async function supabasePasswordLogin(env: Env, email: string, password: string): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data?.access_token ?? null;
}

/** Insere um token nvn_ (hash) na empresa do usuário, via RLS. Devolve null se ok, string de erro se falhou. */
async function inserirTokenDaEmpresa(env: Env, userJwt: string, empresaId: string, tokenHash: string): Promise<string | null> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/mcp_tokens`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ empresa_id: empresaId, token_hash: tokenHash, nome: "Claude (conector)" }),
  });
  if (res.ok) return null;
  const txt = await res.text().catch(() => "(sem body)");
  return `Supabase ${res.status}: ${txt}`;
}

// ─── MCP (JSON-RPC) ───────────────────────────────────────────────────────────
function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function toolText(text: string, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

async function runTool(env: Env, tokenHash: string, name: string, args: Record<string, any>) {
  switch (name) {
    case "criar_lead": {
      const r: any = await callRpc(env, "mcp_criar_lead", {
        p_token_hash: tokenHash,
        p_empresa: args.empresa,
        p_contato: args.contato,
        p_email: args.email ?? null,
        p_telefone: args.telefone ?? null,
        p_valor: args.valor ?? 0,
        p_origem: args.origem ?? "Agente IA",
        p_temperatura: args.temperatura ?? "morno",
        p_segmento: args.segmento ?? null,
        p_cidade: args.cidade ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar lead.", true);
      return toolText(`Lead criado no MakersHub: "${r.cliente}" (contato: ${r.contato}). ID: ${r.lead_id}`);
    }
    case "listar_leads": {
      const r: any = await callRpc(env, "mcp_listar_leads", { p_token_hash: tokenHash, p_etapa: args.etapa ?? null });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar leads.", true);
      const leads = r.leads ?? [];
      return toolText(leads.length === 0 ? "Nenhum lead encontrado." : JSON.stringify(leads, null, 2));
    }
    case "mover_etapa": {
      const r: any = await callRpc(env, "mcp_mover_etapa", {
        p_token_hash: tokenHash,
        p_lead_id: args.lead_id,
        p_etapa: args.etapa,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao mover etapa.", true);
      return toolText(`Lead ${r.lead_id} movido para a etapa "${r.etapa}".`);
    }

    // ── Financeiro ──
    case "criar_lancamento": {
      const r: any = await callRpc(env, "mcp_criar_lancamento", {
        p_token_hash: tokenHash,
        p_tipo: args.tipo,
        p_categoria: args.categoria ?? "Geral",
        p_descricao: args.descricao,
        p_valor: args.valor ?? 0,
        p_vencimento: args.vencimento,
        p_cliente: args.cliente ?? null,
        p_forma_pagamento: args.forma_pagamento ?? null,
        p_observacoes: args.observacoes ?? null,
        p_pago: args.pago ?? false,
        p_carteira_id: args.carteira_id ?? null,
        p_projeto_id: args.projeto_id ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar lançamento.", true);
      return toolText(`Lançamento criado (${r.tipo}, R$ ${r.valor}, status: ${r.status}). ID: ${r.lancamento_id}`);
    }
    case "listar_lancamentos": {
      const r: any = await callRpc(env, "mcp_listar_lancamentos", { p_token_hash: tokenHash, p_tipo: args.tipo ?? null, p_status: args.status ?? null, p_carteira_id: args.carteira_id ?? null });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar lançamentos.", true);
      const ls = r.lancamentos ?? [];
      return toolText(ls.length === 0 ? "Nenhum lançamento encontrado." : JSON.stringify(ls, null, 2));
    }
    case "marcar_pago": {
      const r: any = await callRpc(env, "mcp_marcar_pago", { p_token_hash: tokenHash, p_lancamento_id: args.lancamento_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao marcar pago.", true);
      return toolText(`Lançamento ${r.lancamento_id} marcado como "${r.status}".`);
    }
    case "resumo_financeiro": {
      const r: any = await callRpc(env, "mcp_resumo_financeiro", { p_token_hash: tokenHash, p_carteira: args.carteira ?? null });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao gerar resumo.", true);
      return toolText(JSON.stringify({ escopo: r.escopo, a_receber: r.a_receber, a_pagar: r.a_pagar, atrasados: r.atrasados, recebido_no_mes: r.recebido_no_mes, pago_no_mes: r.pago_no_mes, saldo_do_mes: r.saldo_do_mes }, null, 2));
    }

    // ── Importação / Demo ──
    case "importar_lancamentos": {
      let parsed: unknown;
      try { parsed = JSON.parse(args.dados); } catch {
        return toolText("O campo 'dados' não é um JSON válido. Envie um array JSON como string.", true);
      }
      if (!Array.isArray(parsed)) return toolText("O JSON deve ser um array de lançamentos.", true);
      const r: any = await callRpc(env, "mcp_importar_lancamentos", {
        p_token_hash: tokenHash,
        p_lancamentos: parsed,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao importar lançamentos.", true);
      const errosMsg = r.erros?.length ? `\nErros (${r.erros.length}): ${JSON.stringify(r.erros)}` : "";
      return toolText(`Importação concluída: ${r.inseridos}/${r.total_enviados} lançamentos inseridos.${errosMsg}`);
    }
    case "criar_cenario_demo_financeiro": {
      const r: any = await callRpc(env, "mcp_criar_cenario_demo_financeiro", {
        p_token_hash: tokenHash,
        p_limpar_existentes: args.limpar_existentes ?? false,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar cenário demo.", true);
      return toolText(r.mensagem);
    }
    case "limpar_financeiro": {
      if (!args.confirmar) return toolText("Confirmação necessária: envie confirmar: true para apagar todos os lançamentos.", true);
      const r: any = await callRpc(env, "mcp_limpar_financeiro", { p_token_hash: tokenHash });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao limpar financeiro.", true);
      return toolText(r.mensagem);
    }

    // ── Carteiras ──
    case "listar_carteiras": {
      const r: any = await callRpc(env, "mcp_listar_carteiras", { p_token_hash: tokenHash });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar carteiras.", true);
      const cs = r.carteiras ?? [];
      return toolText(cs.length === 0 ? "Nenhuma carteira cadastrada ainda." : JSON.stringify(cs, null, 2));
    }
    case "criar_carteira": {
      const r: any = await callRpc(env, "mcp_criar_carteira", {
        p_token_hash: tokenHash,
        p_nome: args.nome,
        p_tipo: args.tipo ?? "outro",
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar carteira.", true);
      return toolText(`Carteira "${r.nome}" criada (tipo: ${r.tipo}). ID: ${r.carteira_id}`);
    }
    case "excluir_carteira": {
      const r: any = await callRpc(env, "mcp_excluir_carteira", {
        p_token_hash: tokenHash,
        p_carteira_id: args.carteira_id,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao excluir carteira.", true);
      const movidos = r.lancamentos_movidos ?? 0;
      return toolText(`Carteira "${r.nome}" excluída.${movidos > 0 ? ` ${movidos} lançamento(s) voltaram para a empresa.` : ""}`);
    }

    // ── Projetos ──
    case "criar_projeto": {
      const r: any = await callRpc(env, "mcp_criar_projeto", {
        p_token_hash: tokenHash,
        p_nome: args.nome,
        p_cliente: args.cliente,
        p_descricao: args.descricao ?? null,
        p_valor: args.valor ?? 0,
        p_data_inicio: args.data_inicio ?? null,
        p_data_entrega: args.data_entrega ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar projeto.", true);
      return toolText(`Projeto "${r.nome}" criado. ID: ${r.projeto_id}`);
    }
    case "listar_projetos": {
      const r: any = await callRpc(env, "mcp_listar_projetos", { p_token_hash: tokenHash });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar projetos.", true);
      const ps = r.projetos ?? [];
      return toolText(ps.length === 0 ? "Nenhum projeto encontrado." : JSON.stringify(ps, null, 2));
    }
    case "obter_projeto": {
      const r: any = await callRpc(env, "mcp_obter_projeto", { p_token_hash: tokenHash, p_projeto_id: args.projeto_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao abrir projeto.", true);
      return toolText(JSON.stringify(r.projeto, null, 2));
    }
    case "criar_tarefa_projeto": {
      const r: any = await callRpc(env, "mcp_criar_tarefa_projeto", {
        p_token_hash: tokenHash, p_projeto_id: args.projeto_id, p_titulo: args.titulo, p_etapa: args.etapa ?? null,
        p_responsavel: args.responsavel ?? "Agente IA", p_prazo: args.prazo ?? null, p_prioridade: args.prioridade ?? "media",
        p_descricao: args.descricao ?? null, p_link: args.link ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar tarefa.", true);
      return toolText(`Tarefa "${r.titulo}" criada em ${r.etapa}. ID: ${r.tarefa_id}. Avanço do projeto: ${r.progresso_projeto}%.`);
    }
    case "listar_tarefas_projeto": {
      const r: any = await callRpc(env, "mcp_listar_tarefas_projeto", { p_token_hash: tokenHash, p_projeto_id: args.projeto_id ?? null, p_etapa: args.etapa ?? null, p_apenas_pendentes: args.apenas_pendentes ?? false });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar tarefas.", true);
      const ts = r.tarefas ?? [];
      return toolText(ts.length ? JSON.stringify(ts, null, 2) : "Nenhuma tarefa encontrada.");
    }
    case "atualizar_tarefa_projeto": {
      const r: any = await callRpc(env, "mcp_atualizar_tarefa_projeto", {
        p_token_hash: tokenHash, p_tarefa_id: args.tarefa_id, p_titulo: args.titulo ?? null, p_etapa: args.etapa ?? null,
        p_concluida: args.concluida ?? null, p_responsavel: args.responsavel ?? null, p_prazo: args.prazo ?? null,
        p_prioridade: args.prioridade ?? null, p_descricao: args.descricao ?? null, p_link: args.link ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao atualizar tarefa.", true);
      return toolText(`Tarefa ${r.tarefa_id} atualizada. Avanço do projeto: ${r.progresso_projeto}%.`);
    }
    case "concluir_tarefa_projeto": {
      const r: any = await callRpc(env, "mcp_concluir_tarefa_projeto", { p_token_hash: tokenHash, p_tarefa_id: args.tarefa_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao concluir tarefa.", true);
      return toolText(`Tarefa ${r.tarefa_id} concluída. Avanço do projeto: ${r.progresso_projeto}%.`);
    }

    // ── Follow-ups ──
    case "criar_followup": {
      const r: any = await callRpc(env, "mcp_criar_followup", {
        p_token_hash: tokenHash,
        p_lead_id: args.lead_id,
        p_titulo: args.titulo,
        p_prazo: args.prazo,
        p_responsavel: args.responsavel ?? "Agente IA",
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar follow-up.", true);
      return toolText(`Follow-up criado: "${r.titulo}" (prazo ${r.prazo}). ID: ${r.followup_id}`);
    }

    // ── Agenda ──
    case "criar_evento": {
      const r: any = await callRpc(env, "mcp_criar_evento", {
        p_token_hash: tokenHash,
        p_titulo: args.titulo,
        p_inicio: args.inicio,
        p_fim: args.fim,
        p_descricao: args.descricao ?? null,
        p_tipo: args.tipo ?? "reuniao",
        p_local: args.local ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao criar evento.", true);
      return toolText(`Evento "${r.titulo}" criado para ${r.inicio}. ID: ${r.evento_id}`);
    }
    case "listar_eventos": {
      const r: any = await callRpc(env, "mcp_listar_eventos", { p_token_hash: tokenHash, p_de: args.de ?? null, p_ate: args.ate ?? null });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar eventos.", true);
      const es = r.eventos ?? [];
      return toolText(es.length === 0 ? "Nenhum evento encontrado." : JSON.stringify(es, null, 2));
    }

    // ── Leads: editar / excluir ──
    case "atualizar_lead": {
      const r: any = await callRpc(env, "mcp_atualizar_lead", {
        p_token_hash: tokenHash,
        p_lead_id: args.lead_id,
        p_valor: args.valor ?? null,
        p_temperatura: args.temperatura ?? null,
        p_origem: args.origem ?? null,
        p_responsavel: args.responsavel ?? null,
        p_email: args.email ?? null,
        p_telefone: args.telefone ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao atualizar lead.", true);
      return toolText(`Lead ${r.lead_id} atualizado.`);
    }
    case "excluir_lead": {
      const r: any = await callRpc(env, "mcp_excluir_lead", { p_token_hash: tokenHash, p_lead_id: args.lead_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao excluir lead.", true);
      return toolText(`Lead ${r.lead_id} excluído.`);
    }

    // ── Follow-ups: listar / concluir ──
    case "listar_followups": {
      const r: any = await callRpc(env, "mcp_listar_followups", {
        p_token_hash: tokenHash,
        p_apenas_pendentes: args.apenas_pendentes ?? true,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao listar follow-ups.", true);
      const fs = r.followups ?? [];
      return toolText(fs.length === 0 ? "Nenhum follow-up encontrado." : JSON.stringify(fs, null, 2));
    }
    case "concluir_followup": {
      const r: any = await callRpc(env, "mcp_concluir_followup", { p_token_hash: tokenHash, p_followup_id: args.followup_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao concluir follow-up.", true);
      return toolText(`Follow-up ${r.followup_id} marcado como concluído.`);
    }

    // ── Financeiro: editar / excluir / desfazer ──
    case "atualizar_lancamento": {
      const r: any = await callRpc(env, "mcp_atualizar_lancamento", {
        p_token_hash: tokenHash,
        p_lancamento_id: args.lancamento_id,
        p_descricao: args.descricao ?? null,
        p_valor: args.valor ?? null,
        p_categoria: args.categoria ?? null,
        p_vencimento: args.vencimento ?? null,
        p_cliente: args.cliente ?? null,
        p_forma_pagamento: args.forma_pagamento ?? null,
        p_observacoes: args.observacoes ?? null,
        p_carteira_id: args.carteira_id ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao atualizar lançamento.", true);
      return toolText(`Lançamento ${r.lancamento_id} atualizado (status: ${r.status}).`);
    }
    case "excluir_lancamento": {
      const r: any = await callRpc(env, "mcp_excluir_lancamento", { p_token_hash: tokenHash, p_lancamento_id: args.lancamento_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao excluir lançamento.", true);
      return toolText(`Lançamento ${r.lancamento_id} excluído.`);
    }
    case "desfazer_pagamento": {
      const r: any = await callRpc(env, "mcp_desfazer_pagamento", { p_token_hash: tokenHash, p_lancamento_id: args.lancamento_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao desfazer pagamento.", true);
      return toolText(`Pagamento do lançamento ${r.lancamento_id} desfeito (status: ${r.status}).`);
    }

    // ── Projetos: editar / excluir ──
    case "atualizar_projeto": {
      const r: any = await callRpc(env, "mcp_atualizar_projeto", {
        p_token_hash: tokenHash,
        p_projeto_id: args.projeto_id,
        p_nome: args.nome ?? null,
        p_cliente: args.cliente ?? null,
        p_descricao: args.descricao ?? null,
        p_fase: args.fase ?? null,
        p_progresso: args.progresso ?? null,
        p_valor: args.valor ?? null,
        p_data_entrega: args.data_entrega ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao atualizar projeto.", true);
      return toolText(`Projeto ${r.projeto_id} atualizado.`);
    }
    case "excluir_projeto": {
      const r: any = await callRpc(env, "mcp_excluir_projeto", { p_token_hash: tokenHash, p_projeto_id: args.projeto_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao excluir projeto.", true);
      return toolText(`Projeto ${r.projeto_id} excluído.`);
    }

    // ── Agenda: editar / excluir ──
    case "atualizar_evento": {
      const r: any = await callRpc(env, "mcp_atualizar_evento", {
        p_token_hash: tokenHash,
        p_evento_id: args.evento_id,
        p_titulo: args.titulo ?? null,
        p_inicio: args.inicio ?? null,
        p_fim: args.fim ?? null,
        p_descricao: args.descricao ?? null,
        p_tipo: args.tipo ?? null,
        p_local: args.local ?? null,
      });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao atualizar evento.", true);
      return toolText(`Evento ${r.evento_id} atualizado.`);
    }
    case "excluir_evento": {
      const r: any = await callRpc(env, "mcp_excluir_evento", { p_token_hash: tokenHash, p_evento_id: args.evento_id });
      if (!r?.ok) return toolText(r?.erro ?? "Erro ao excluir evento.", true);
      return toolText(`Evento ${r.evento_id} excluído.`);
    }

    default:
      return toolText(`Ferramenta desconhecida: ${name}`, true);
  }
}

async function handleRpc(env: Env, tokenHash: string, msg: any): Promise<unknown | null> {
  const { id, method, params } = msg ?? {};
  switch (method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return jsonRpcResult(id, {});
    case "tools/list":
      return jsonRpcResult(id, { tools: TOOLS });
    case "tools/call": {
      try {
        return jsonRpcResult(id, await runTool(env, tokenHash, params?.name, params?.arguments ?? {}));
      } catch (e: any) {
        return jsonRpcResult(id, toolText(`Erro: ${e?.message ?? e}`, true));
      }
    }
    default:
      return jsonRpcError(id, -32601, `Método não suportado: ${method}`);
  }
}

// ─── OAuth: metadata ─────────────────────────────────────────────────────────
function protectedResourceMetadata(base: string) {
  return {
    // O claude.ai usa o resource COM barra final ("https://.../") e valida que
    // este campo bate exatamente (RFC 8707/9728). Por isso devolvemos base + "/".
    resource: `${base}/`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}
function authServerMetadata(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
}

// ─── OAuth: registro dinâmico de cliente (RFC 7591) ──────────────────────────
async function handleRegister(env: Env, request: Request): Promise<Response> {
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const redirectUris: string[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (redirectUris.length === 0) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris obrigatório" }, { status: 400, headers: CORS });
  }
  // client_id = token assinado contendo as redirect_uris registradas (sem estado).
  const clientId = await signToken(env.OAUTH_SIGNING_KEY, { ru: redirectUris, t: "client", iat: Date.now() });
  return Response.json(
    {
      client_id: clientId,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      client_name: body?.client_name ?? "Claude",
    },
    { status: 201, headers: CORS },
  );
}

// ─── OAuth: validação de redirect_uri ───────────────────────────────────────
// Clientes públicos (Claude) podem não fazer registro dinâmico ou usar um
// client_id cacheado. A segurança vem do PKCE + redirect_uri confiável: só
// aceitamos callbacks dos domínios do Claude/Anthropic (ou localhost no app).
const KNOWN_REDIRECT_HOSTS = [
  // Claude / Anthropic
  "claude.ai", "claudeusercontent.com", "anthropic.com", "claude.com",
  // ChatGPT / OpenAI
  "chatgpt.com", "openai.com", "oaiusercontent.com",
];
function redirectAllowed(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return u.protocol === "https:" && KNOWN_REDIRECT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}
/** Valida o redirect_uri: contra o client registrado (se houver) ou a allowlist. */
async function redirectUriOk(env: Env, clientId: string, redirectUri: string): Promise<boolean> {
  if (!redirectUri) return false;
  const client = await verifyToken<any>(env.OAUTH_SIGNING_KEY, clientId ?? "");
  if (client && client.t === "client" && Array.isArray(client.ru)) return client.ru.includes(redirectUri);
  return redirectAllowed(redirectUri);
}

// ─── OAuth: tela de login/consentimento ──────────────────────────────────────
function loginPage(params: Record<string, string>, erro?: string): Response {
  const hidden = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"]
    .map((k) => `<input type="hidden" name="${k}" value="${escapeHtml(params[k] ?? "")}">`)
    .join("\n");
  const html = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar ao MakersHub</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0a0a0b; color:#e7e7ea;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; padding:24px; }
  .card { width:100%; max-width:380px; background:#141416; border:1px solid #26262b; border-radius:20px;
    padding:32px 28px; box-shadow:0 24px 60px -20px rgba(0,0,0,.6); }
  .logo-wrap { width:64px; height:64px; margin:0 auto 20px; display:block;
    filter:drop-shadow(0 0 20px rgba(144,248,38,0.5)); }
  h1 { font-size:18px; text-align:center; margin:0 0 4px; }
  p.sub { font-size:13px; color:#9a9aa2; text-align:center; margin:0 0 24px; }
  label { display:block; font-size:12px; color:#9a9aa2; margin:0 0 6px; }
  input.field { width:100%; height:42px; padding:0 12px; margin-bottom:14px; border-radius:10px;
    border:1px solid #2e2e34; background:#0e0e10; color:#e7e7ea; font-size:14px;
    -webkit-appearance:none; appearance:none; }
  input.field:focus { outline:none; border-color:#90f826; }
  .pw-wrap { position:relative; margin-bottom:14px; }
  .pw-wrap input.field { margin-bottom:0; padding-right:42px; width:100%; }
  .pw-toggle { position:absolute; right:12px; top:50%; transform:translateY(-50%);
    background:none; border:none; padding:0; cursor:pointer; color:#6b6b72; width:auto; height:auto;
    display:flex; align-items:center; }
  .pw-toggle:hover { color:#e7e7ea; filter:none; }
  button.submit { width:100%; height:44px; border:0; border-radius:10px; background:#90f826; color:#0a0a0b;
    font-weight:700; font-size:14px; cursor:pointer; margin-top:4px; }
  button.submit:hover { filter:brightness(1.08); }
  .erro { background:#3a1416; border:1px solid #5a2326; color:#ffb4b4; font-size:12px; padding:10px 12px;
    border-radius:10px; margin-bottom:16px; }
  .foot { font-size:11px; color:#6b6b72; text-align:center; margin-top:18px; line-height:1.5; }
</style></head><body>
  <form class="card" method="POST" action="/authorize">
    <svg class="logo-wrap" viewBox="0 0 1500 1500" xmlns="http://www.w3.org/2000/svg" aria-label="MakersHub">
      <path fill="#141c22" d="M 423.578125 156.542969 L 1076.464844 156.542969 L 1108.109375 158.207031 L 1148.082031 168.199219 L 1169.734375 176.527344 L 1196.382812 189.851562 L 1219.699219 206.507812 L 1238.019531 221.496094 L 1249.679688 231.488281 L 1261.335938 244.8125 L 1274.660156 261.46875 L 1286.320312 278.125 L 1299.644531 304.773438 L 1307.972656 324.757812 L 1316.300781 354.738281 L 1321.296875 393.046875 L 1321.296875 1059.257812 L 1316.300781 1099.230469 L 1304.640625 1135.871094 L 1297.976562 1150.859375 L 1284.652344 1177.507812 L 1268 1200.828125 L 1253.007812 1217.480469 L 1246.347656 1225.808594 L 1229.691406 1239.132812 L 1221.363281 1247.460938 L 1203.042969 1259.121094 L 1189.71875 1267.449219 L 1163.070312 1280.773438 L 1139.753906 1289.101562 L 1104.777344 1297.425781 L 396.929688 1297.425781 L 366.949219 1290.765625 L 341.964844 1282.4375 L 315.316406 1269.113281 L 295.332031 1257.453125 L 273.679688 1242.464844 L 265.351562 1235.804688 L 258.6875 1229.140625 L 258.6875 1225.808594 L 252.027344 1222.480469 L 243.699219 1214.152344 L 242.035156 1209.15625 L 237.039062 1207.488281 L 213.71875 1172.511719 L 207.058594 1160.855469 L 202.0625 1149.195312 L 195.398438 1134.207031 L 185.40625 1102.5625 L 180.410156 1069.25 L 180.410156 383.054688 L 183.742188 356.40625 L 195.398438 319.761719 L 202.0625 304.773438 L 215.386719 278.125 L 227.042969 261.46875 L 240.367188 244.8125 L 267.015625 218.164062 L 280.339844 206.507812 L 300.328125 193.183594 L 311.984375 186.519531 L 338.632812 173.195312 L 356.957031 166.535156 L 393.597656 158.207031 Z" fill-rule="nonzero"/>
      <path fill="#90f826" d="M 426.90625 496.308594 L 576.804688 496.308594 L 578.46875 719.488281 L 605.117188 681.183594 L 626.769531 649.539062 L 650.089844 616.226562 L 676.738281 577.917969 L 700.054688 544.609375 L 718.375 517.960938 L 733.363281 496.308594 L 864.941406 496.308594 L 866.605469 719.488281 L 879.929688 701.167969 L 891.589844 684.511719 L 918.238281 646.207031 L 944.886719 607.898438 L 963.207031 581.25 L 986.523438 547.941406 L 1004.84375 521.292969 L 1021.5 497.972656 L 1023.167969 496.308594 L 1156.410156 496.308594 L 1156.410156 960.992188 L 1004.84375 960.992188 L 1003.179688 741.140625 L 981.527344 771.121094 L 959.875 802.765625 L 938.222656 832.746094 L 919.902344 859.394531 L 908.246094 876.050781 L 888.257812 904.363281 L 871.601562 927.679688 L 853.28125 954.328125 L 848.285156 960.992188 L 716.710938 960.992188 L 715.042969 739.476562 L 693.390625 771.121094 L 675.070312 796.105469 L 653.417969 827.75 L 631.765625 857.726562 L 608.449219 891.039062 L 588.464844 919.351562 L 566.8125 950.996094 L 560.148438 960.992188 L 430.238281 960.992188 L 428.574219 652.867188 L 383.605469 697.835938 L 376.941406 706.164062 L 370.28125 707.832031 L 345.296875 682.847656 L 333.636719 669.523438 L 300.328125 636.214844 L 296.996094 627.886719 L 346.960938 577.917969 L 358.621094 564.59375 Z" fill-rule="nonzero"/>
    </svg>
    <h1>Conectar ao MakersHub</h1>
    <p class="sub">Entre com sua conta para autorizar o acesso ao seu CRM.</p>
    ${erro ? `<div class="erro">${escapeHtml(erro)}</div>` : ""}
    ${hidden}
    <label for="email">E-mail</label>
    <input id="email" class="field" type="email" name="email" placeholder="voce@produtora.com" autocomplete="email" required autofocus>
    <label for="password">Senha</label>
    <div class="pw-wrap">
      <input id="password" class="field" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
      <button type="button" class="pw-toggle" aria-label="Mostrar senha" onclick="var i=document.getElementById('password');i.type=i.type==='password'?'text':'password';this.innerHTML=i.type==='password'?eye:eyeOff;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
    <script>
      var eye='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      var eyeOff='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';
    </script>
    <button class="submit" type="submit">Entrar e autorizar</button>
    <p class="foot">Você pode revogar o acesso a qualquer momento em<br>Configurações → Agente IA.</p>
  </form>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", ...CORS } });
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── OAuth: GET /authorize (mostra form) ─────────────────────────────────────
async function handleAuthorizeGet(env: Env, url: URL): Promise<Response> {
  const p = Object.fromEntries(url.searchParams.entries());
  if (p.response_type !== "code") return badAuthorize("response_type deve ser 'code'");
  if (p.code_challenge_method !== "S256") return badAuthorize("PKCE S256 obrigatório");
  if (!(await redirectUriOk(env, p.client_id, p.redirect_uri)))
    return badAuthorize("redirect_uri não permitido: " + (p.redirect_uri ?? "(vazio)"));
  return loginPage(p);
}
function badAuthorize(msg: string): Response {
  return new Response(`Erro de autorização: ${msg}`, { status: 400, headers: { ...CORS, "content-type": "text/plain; charset=utf-8" } });
}

// ─── OAuth: POST /authorize (faz login, emite código) ────────────────────────
async function handleAuthorizePost(env: Env, request: Request): Promise<Response> {
  const form = new URLSearchParams(await request.text());
  const p = Object.fromEntries(form.entries());

  if (!(await redirectUriOk(env, p.client_id, p.redirect_uri)))
    return badAuthorize("redirect_uri não permitido: " + (p.redirect_uri ?? "(vazio)"));

  // 1. login no Supabase
  const jwt = await supabasePasswordLogin(env, p.email ?? "", p.password ?? "");
  if (!jwt) return loginPage(p, "E-mail ou senha incorretos.");

  // 2. resolve a empresa
  let empresaId: string | null = null;
  try {
    empresaId = (await callRpc(env, "minha_empresa_id", {}, jwt)) as string;
  } catch (e: any) {
  }
  if (!empresaId) return loginPage(p, "Sua conta ainda não tem uma produtora. Faça o onboarding no app primeiro.");

  // 3. gera o token nvn_ e salva o hash na empresa (via RLS, com o JWT do usuário)
  const nvn = genNvnToken();
  const erroInsert = await inserirTokenDaEmpresa(env, jwt, empresaId, await sha256Hex(nvn));
  if (erroInsert) return loginPage(p, `Não foi possível criar o acesso: ${erroInsert}`);

  // 4. emite o código de autorização (assinado, com TTL) e redireciona
  // Carregamos o scope EXATO que o cliente pediu p/ ecoar de volta no /token
  // (OAuth 2.1: o scope concedido deve ser subconjunto do solicitado).
  const code = await signToken(env.OAUTH_SIGNING_KEY, {
    t: "code",
    nvn,
    cc: p.code_challenge,
    ru: p.redirect_uri,
    sc: p.scope ?? "",
    exp: Date.now() + CODE_TTL_SECONDS * 1000,
  });
  const redirect = new URL(p.redirect_uri);
  redirect.searchParams.set("code", code);
  if (p.state) redirect.searchParams.set("state", p.state);
  return new Response(null, { status: 302, headers: { Location: redirect.toString(), ...CORS } });
}

// ─── OAuth: POST /token (troca código por access_token) ───────────────────────
async function handleToken(env: Env, request: Request): Promise<Response> {
  const ct = request.headers.get("content-type") ?? "";
  let p: Record<string, string> = {};
  if (ct.includes("application/json")) {
    p = (await request.json().catch(() => ({}))) as any;
  } else {
    p = Object.fromEntries(new URLSearchParams(await request.text()).entries());
  }


  let nvn: string;
  let sc = "";

  if (p.grant_type === "refresh_token") {
    // Renovação: o refresh_token é um token assinado que carrega o nvn_.
    const rt = await verifyToken<any>(env.OAUTH_SIGNING_KEY, p.refresh_token ?? "");
    if (!rt || rt.t !== "refresh") { return Response.json({ error: "invalid_grant", error_description: "refresh_token inválido" }, { status: 400, headers: CORS }); }
    nvn = rt.nvn;
    sc = rt.sc ?? "";
  } else if (p.grant_type === "authorization_code") {
    const code = await verifyToken<any>(env.OAUTH_SIGNING_KEY, p.code ?? "");
    if (!code || code.t !== "code") { return Response.json({ error: "invalid_grant", error_description: "código inválido" }, { status: 400, headers: CORS }); }
    if (Date.now() > code.exp) { return Response.json({ error: "invalid_grant", error_description: "código expirado" }, { status: 400, headers: CORS }); }
    if (p.redirect_uri && p.redirect_uri !== code.ru) { return Response.json({ error: "invalid_grant", error_description: "redirect_uri não confere" }, { status: 400, headers: CORS }); }
    // PKCE: base64url(sha256(code_verifier)) deve bater com o code_challenge
    const expected = b64urlFromBytes(await sha256Bytes(p.code_verifier ?? ""));
    if (expected !== code.cc) { return Response.json({ error: "invalid_grant", error_description: "PKCE inválido" }, { status: 400, headers: CORS }); }
    nvn = code.nvn;
    sc = code.sc ?? "";
  } else {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS });
  }

  // O access_token É o token nvn_ (o endpoint MCP já sabe validá-lo).
  // Emitimos também um refresh_token (assinado) — clientes como o Claude esperam
  // poder renovar quando há expires_in. RFC 6749 §5.1, headers obrigatórios.
  const refreshToken = await signToken(env.OAUTH_SIGNING_KEY, { t: "refresh", nvn, sc, iat: Date.now() });
  const tokenResp: Record<string, unknown> = {
    access_token: nvn,
    token_type: "Bearer",
    expires_in: 31536000,
    refresh_token: refreshToken,
  };
  if (sc) tokenResp.scope = sc; // só ecoa se foi solicitado
  return new Response(JSON.stringify(tokenResp), {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

// ─── Entrada ──────────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const base = url.origin;
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      const reqHeaders = request.headers.get("Access-Control-Request-Headers");
      // Espelha os headers solicitados p/ nunca bloquear o preflight.
      return new Response(null, {
        headers: { ...CORS, ...(reqHeaders ? { "Access-Control-Allow-Headers": reqHeaders } : {}), "Access-Control-Max-Age": "86400" },
      });
    }

    // Descoberta OAuth — no-store p/ o claude/edge NUNCA servir metadata velha
    const noStore = { ...CORS, "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
    if (path === "/.well-known/oauth-protected-resource")
      return new Response(JSON.stringify(protectedResourceMetadata(base)), { headers: noStore });
    if (path === "/.well-known/oauth-authorization-server" || path === "/.well-known/openid-configuration")
      return new Response(JSON.stringify(authServerMetadata(base)), { headers: noStore });

    // Endpoints OAuth
    if (path === "/register" && request.method === "POST") return handleRegister(env, request);
    if (path === "/authorize" && request.method === "GET") return handleAuthorizeGet(env, url);
    if (path === "/authorize" && request.method === "POST") return handleAuthorizePost(env, request);
    if (path === "/token" && request.method === "POST") return handleToken(env, request);

    // Endpoint MCP (/ , /mcp ou /sse)
    if (path === "/" || path === "/mcp" || path === "/sse") {
      // Token: aceita nvn_ direto (Claude Code) ou access_token do OAuth (= nvn_).
      const auth = request.headers.get("Authorization") ?? "";
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

      // Sem token → 401 com WWW-Authenticate em QUALQUER método (GET/POST).
      // É isso que faz o Claude descobrir o OAuth e abrir a tela de login.
      if (!token) {
        return new Response(JSON.stringify(jsonRpcError(null, -32001, "Não autorizado.")), {
          status: 401,
          headers: {
            ...CORS,
            "content-type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
          },
        });
      }

      // Com token, mas GET: não temos stream servidor→cliente (modo stateless).
      // 405 faz o cliente usar só POST (Streamable HTTP), que é o que suportamos.
      if (request.method === "GET")
        return new Response(JSON.stringify(jsonRpcError(null, -32000, "Use POST.")), {
          status: 405,
          headers: { ...CORS, "content-type": "application/json", Allow: "POST" },
        });
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

      const tokenHash = await sha256Hex(token);

      let body: any;
      try {
        body = await request.json();
      } catch {
        return Response.json(jsonRpcError(null, -32700, "JSON inválido."), { headers: CORS });
      }

      if (Array.isArray(body)) {
        const responses = (await Promise.all(body.map((m) => handleRpc(env, tokenHash, m)))).filter(Boolean);
        return Response.json(responses, { headers: CORS });
      }
      const response = await handleRpc(env, tokenHash, body);
      if (response === null) return new Response(null, { status: 202, headers: CORS });
      return Response.json(response, { headers: CORS });
    }

    return new Response("Not Found", { status: 404, headers: CORS });
  },
};
