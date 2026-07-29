export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string;
          nome: string;
          logo_url: string | null;
          accent_color: string | null;
          criado_em: string;
          trial_expires_at: string | null;
          razao_social: string | null;
          cnpj: string | null;
          endereco: string | null;
          cidade: string | null;
          estado: string | null;
          cep: string | null;
          plano: string;
          custos_tabela: unknown | null;
          meta_mensal: number | null;
          meta_super: number | null;
        };
        Insert: {
          id?: string;
          nome: string;
          logo_url?: string | null;
          accent_color?: string | null;
          criado_em?: string;
          trial_expires_at?: string | null;
          razao_social?: string | null;
          cnpj?: string | null;
          endereco?: string | null;
          cidade?: string | null;
          estado?: string | null;
          cep?: string | null;
          plano?: string;
          custos_tabela?: unknown | null;
          meta_mensal?: number | null;
          meta_super?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["empresas"]["Insert"]>;
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          email: string;
          cargo: string | null;
          role: "admin" | "membro";
          permissoes: Json;
          criado_em: string;
        };
        Insert: {
          id: string;
          empresa_id: string;
          nome: string;
          email: string;
          cargo?: string | null;
          role?: "admin" | "membro";
          permissoes?: Json;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          email: string | null;
          telefone: string | null;
          empresa: string | null;
          status: "lead" | "contato" | "proposta" | "cliente" | "inativo";
          notas: string | null;
          cliente_id: string | null;
          links: unknown;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          email?: string | null;
          telefone?: string | null;
          empresa?: string | null;
          status?: "lead" | "contato" | "proposta" | "cliente" | "inativo";
          notas?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clientes"]["Insert"]>;
        Relationships: [];
      };
      projetos: {
        Row: {
          id: string;
          empresa_id: string;
          cliente_id: string | null;
          nome: string;
          cliente: string;
          descricao: string | null;
          fase:
            | "briefing"
            | "pre"
            | "captacao"
            | "edicao"
            | "revisao"
            | "entrega"
            | "concluido"
            | "pausado";
          progresso: number;
          fases: string[];
          equipe: string[];
          data_inicio: string;
          data_entrega: string | null;
          arquivado: boolean;
          valor: number;
          cor: string;
          notas: string | null;
          links: unknown;
          portal_visible: boolean;
          portal_phase: string;
          portal_progress: number;
          portal_update: string | null;
          portal_next_milestone: string | null;
          portal_cover_url: string | null;
          portal_updated_at: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          cliente: string;
          descricao?: string | null;
          fase?:
            | "briefing"
            | "pre"
            | "captacao"
            | "edicao"
            | "revisao"
            | "entrega"
            | "concluido"
            | "pausado";
          progresso?: number;
          fases?: string[];
          equipe?: string[];
          data_inicio: string;
          data_entrega?: string | null;
          arquivado?: boolean;
          valor?: number;
          cor?: string;
          notas?: string | null;
          cliente_id?: string | null;
          links?: unknown;
          portal_visible?: boolean;
          portal_phase?: string;
          portal_progress?: number;
          portal_update?: string | null;
          portal_next_milestone?: string | null;
          portal_cover_url?: string | null;
          portal_updated_at?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projetos"]["Insert"]>;
        Relationships: [];
      };
      tarefas: {
        Row: {
          id: string;
          empresa_id: string;
          projeto_id: string;
          titulo: string;
          descricao: string | null;
          status: string;
          concluida: boolean;
          responsavel: string;
          prazo: string | null;
          prioridade: "baixa" | "media" | "alta" | "urgente";
          link: string | null;
          prazo_fim: string | null;
          dia_todo: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          projeto_id: string;
          titulo: string;
          descricao?: string | null;
          status?: string;
          concluida?: boolean;
          responsavel?: string;
          prazo?: string | null;
          prioridade?: "baixa" | "media" | "alta" | "urgente";
          link?: string | null;
          prazo_fim?: string | null;
          dia_todo?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tarefas"]["Insert"]>;
        Relationships: [];
      };
      marcos: {
        Row: {
          id: string;
          empresa_id: string;
          projeto_id: string;
          titulo: string;
          data: string;
          status: "pendente" | "concluido" | "atrasado";
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          projeto_id: string;
          titulo: string;
          data: string;
          status?: "pendente" | "concluido" | "atrasado";
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marcos"]["Insert"]>;
        Relationships: [];
      };
      entregaveis: {
        Row: {
          id: string;
          empresa_id: string;
          projeto_id: string;
          titulo: string;
          tipo: "video" | "foto" | "doc" | "design" | "audio" | "outro";
          status: "pendente" | "em_revisao" | "aprovado" | "entregue";
          link: string | null;
          notas: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          projeto_id: string;
          titulo: string;
          tipo?: "video" | "foto" | "doc" | "design" | "audio" | "outro";
          status?: "pendente" | "em_revisao" | "aprovado" | "entregue";
          link?: string | null;
          notas?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["entregaveis"]["Insert"]>;
        Relationships: [];
      };
      portal_review_versions: {
        Row: {
          id: string;
          empresa_id: string;
          projeto_id: string;
          entregavel_id: string | null;
          thread_id: string;
          version_number: number;
          version_label: string;
          title: string;
          content_cycle: string | null;
          drive_url: string;
          drive_file_id: string | null;
          embed_url: string | null;
          message: string | null;
          status: "draft" | "pending" | "changes_requested" | "approved" | "archived";
          kind: "review" | "delivery";
          due_at: string | null;
          published_at: string | null;
          decided_at: string | null;
          client_name: string | null;
          client_feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          projeto_id: string;
          entregavel_id?: string | null;
          thread_id: string;
          version_number: number;
          version_label: string;
          title: string;
          content_cycle?: string | null;
          drive_url: string;
          drive_file_id?: string | null;
          embed_url?: string | null;
          message?: string | null;
          status?: "draft" | "pending" | "changes_requested" | "approved" | "archived";
          kind?: "review" | "delivery";
          due_at?: string | null;
          published_at?: string | null;
          decided_at?: string | null;
          client_name?: string | null;
          client_feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["portal_review_versions"]["Insert"]>;
        Relationships: [];
      };
      financeiro: {
        Row: {
          id: string;
          empresa_id: string;
          projeto_id: string | null;
          tipo: "receita" | "despesa";
          categoria: string;
          descricao: string;
          valor: number;
          data: string;
          vencimento: string | null;
          pagamento_em: string | null;
          cliente: string | null;
          forma_pagamento: string | null;
          observacoes: string | null;
          carteira_id: string | null;
          comprovante_url: string | null;
          status: "previsto" | "recebido" | "pago" | "atrasado" | "cancelado";
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          projeto_id?: string | null;
          tipo: "receita" | "despesa";
          categoria: string;
          descricao: string;
          valor: number;
          data: string;
          vencimento?: string | null;
          pagamento_em?: string | null;
          cliente?: string | null;
          forma_pagamento?: string | null;
          observacoes?: string | null;
          carteira_id?: string | null;
          comprovante_url?: string | null;
          status?: "previsto" | "recebido" | "pago" | "atrasado" | "cancelado";
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["financeiro"]["Insert"]>;
        Relationships: [];
      };
      clientes_comercial: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          segmento: string;
          cidade: string;
          site: string | null;
          instagram: string | null;
          observacoes: string | null;
          accent_color: string | null;
          arquivado: boolean;
          cliente_ativo: boolean;
          status: "prospect" | "cliente" | "inativo";
          portal_enabled: boolean;
          portal_token: string | null;
          portal_last_access_at: string | null;
          portal_welcome_message: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          segmento?: string;
          cidade?: string;
          site?: string | null;
          instagram?: string | null;
          observacoes?: string | null;
          accent_color?: string | null;
          arquivado?: boolean;
          cliente_ativo?: boolean;
          status?: "prospect" | "cliente" | "inativo";
          portal_enabled?: boolean;
          portal_token?: string | null;
          portal_last_access_at?: string | null;
          portal_welcome_message?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clientes_comercial"]["Insert"]>;
        Relationships: [];
      };
      contatos_comercial: {
        Row: {
          id: string;
          empresa_id: string;
          cliente_id: string;
          nome: string;
          cargo: string;
          email: string;
          telefone: string;
          principal: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          cliente_id: string;
          nome: string;
          cargo?: string;
          email?: string;
          telefone?: string;
          principal?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contatos_comercial"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          empresa_id: string;
          cliente_id: string;
          contato_id: string;
          etapa:
            | "novo"
            | "diagnostico"
            | "reuniao"
            | "proposta"
            | "negociacao"
            | "fechado"
            | "perdido";
          valor: number;
          responsavel: string;
          temperatura: "frio" | "morno" | "quente";
          origem: string;
          proxima_acao: Json | null;
          observacoes: string | null;
          criado_em: string;
          arquivado: boolean;
          arquivado_em: string | null;
          arquivado_por: string | null;
          motivo_arquivamento: string | null;
          etapa_antes_arquivar:
            | "novo"
            | "diagnostico"
            | "reuniao"
            | "proposta"
            | "negociacao"
            | "fechado"
            | "perdido"
            | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          cliente_id: string;
          contato_id: string;
          etapa?:
            | "novo"
            | "diagnostico"
            | "reuniao"
            | "proposta"
            | "negociacao"
            | "fechado"
            | "perdido";
          valor?: number;
          responsavel?: string;
          temperatura?: "frio" | "morno" | "quente";
          origem?: string;
          proxima_acao?: Json | null;
          observacoes?: string | null;
          criado_em?: string;
          arquivado?: boolean;
          arquivado_em?: string | null;
          arquivado_por?: string | null;
          motivo_arquivamento?: string | null;
          etapa_antes_arquivar?:
            | "novo"
            | "diagnostico"
            | "reuniao"
            | "proposta"
            | "negociacao"
            | "fechado"
            | "perdido"
            | null;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      configuracao_comercial: {
        Row: {
          empresa_id: string;
          etapas_labels: Json;
          atualizado_em: string;
        };
        Insert: {
          empresa_id: string;
          etapas_labels?: Json;
          atualizado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["configuracao_comercial"]["Insert"]>;
        Relationships: [];
      };
      timeline_lead: {
        Row: {
          id: string;
          empresa_id: string;
          lead_id: string;
          tipo:
            | "criado"
            | "ligacao"
            | "reuniao"
            | "whatsapp"
            | "email"
            | "proposta_enviada"
            | "observacao"
            | "etapa_mudou"
            | "fechado"
            | "perdido"
            | "arquivado"
            | "restaurado";
          titulo: string;
          descricao: string | null;
          quando: string;
          autor: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          lead_id: string;
          tipo:
            | "criado"
            | "ligacao"
            | "reuniao"
            | "whatsapp"
            | "email"
            | "proposta_enviada"
            | "observacao"
            | "etapa_mudou"
            | "fechado"
            | "perdido"
            | "arquivado"
            | "restaurado";
          titulo: string;
          descricao?: string | null;
          quando?: string;
          autor?: string;
        };
        Update: Partial<Database["public"]["Tables"]["timeline_lead"]["Insert"]>;
        Relationships: [];
      };
      tarefas_lead: {
        Row: {
          id: string;
          empresa_id: string;
          lead_id: string;
          titulo: string;
          responsavel: string;
          prazo: string;
          feita: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          lead_id: string;
          titulo: string;
          responsavel?: string;
          prazo: string;
          feita?: boolean;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tarefas_lead"]["Insert"]>;
        Relationships: [];
      };
      carteiras: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          tipo: "pj" | "pf" | "dinheiro" | "cartao" | "outro";
          created_at: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          tipo?: "pj" | "pf" | "dinheiro" | "cartao" | "outro";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carteiras"]["Insert"]>;
        Relationships: [];
      };
      orcamentos: {
        Row: {
          id: string;
          empresa_id: string;
          tipo: string;
          geral: unknown;
          producao: unknown;
          pos: unknown;
          extras: unknown;
          margem: number;
          calculo: unknown;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          tipo: string;
          geral?: unknown;
          producao?: unknown;
          pos?: unknown;
          extras?: unknown;
          margem?: number;
          calculo?: unknown;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orcamentos"]["Insert"]>;
        Relationships: [];
      };
      orcamento_templates: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          tipo: string;
          payload: unknown;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          tipo: string;
          payload?: unknown;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orcamento_templates"]["Insert"]>;
        Relationships: [];
      };
      equipe_convites: {
        Row: {
          id: string;
          empresa_id: string;
          email: string;
          nome: string | null;
          role: "admin" | "membro";
          permissoes: Json;
          token: string;
          status: "pendente" | "aceito" | "expirado";
          expira_em: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          email: string;
          nome?: string | null;
          role?: "admin" | "membro";
          permissoes?: Json;
          token?: string;
          status?: "pendente" | "aceito" | "expirado";
          expira_em?: string;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipe_convites"]["Insert"]>;
        Relationships: [];
      };
      comercial_lead_links: {
        Row: {
          id: string;
          empresa_id: string;
          lead_id: string;
          tipo: "proposta" | "contrato" | "projeto" | "financeiro" | "onboarding";
          entidade_id: string;
          origem: "fechamento" | "manual";
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          lead_id: string;
          tipo: "proposta" | "contrato" | "projeto" | "financeiro" | "onboarding";
          entidade_id: string;
          origem?: "fechamento" | "manual";
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comercial_lead_links"]["Insert"]>;
        Relationships: [];
      };
      eventos: {
        Row: {
          id: string;
          empresa_id: string;
          titulo: string;
          descricao: string | null;
          inicio: string;
          fim: string;
          dia_todo: boolean;
          tipo: "reuniao" | "gravacao" | "edicao" | "entrega" | "tarefa" | "outro";
          local: string | null;
          participantes: string[];
          ref_tipo: "projeto" | "tarefa" | "marco" | null;
          ref_id: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          titulo: string;
          descricao?: string | null;
          inicio: string;
          fim: string;
          dia_todo?: boolean;
          tipo?: "reuniao" | "gravacao" | "edicao" | "entrega" | "tarefa" | "outro";
          local?: string | null;
          participantes?: string[] | null;
          ref_tipo?: "projeto" | "tarefa" | "marco" | null;
          ref_id?: string | null;
          criado_em?: string;
        };
        Update: Partial<Database["public"]["Tables"]["eventos"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      minha_empresa_id: { Args: Record<string, never>; Returns: string };
      importar_contatos_comercial: {
        Args: { p_contatos: Json; p_modo?: "ignorar" | "atualizar" };
        Returns: Json;
      };
      criar_empresa_onboarding: {
        Args: {
          p_nome: string;
          p_accent_color: string;
          p_logo_url: string | null;
          p_user_nome: string;
          p_user_email: string;
        };
        Returns: string;
      };
      info_convite: {
        Args: { p_token: string };
        Returns: {
          email: string;
          nome: string | null;
          role: string;
          permissoes: Json;
          empresa_nome: string;
          empresa_id: string;
        };
      };
      aceitar_convite: { Args: { p_token: string; p_nome: string }; Returns: Json };
      cancelar_convite: { Args: { p_id: string }; Returns: undefined };
      remover_membro: { Args: { p_usuario_id: string }; Returns: undefined };
      alterar_papel_membro: {
        Args: { p_usuario_id: string; p_role: string; p_permissoes: Json };
        Returns: undefined;
      };
      configurar_makers_members: {
        Args: {
          p_cliente_id: string;
          p_enabled: boolean;
          p_welcome_message: string | null;
          p_rotate_token: boolean;
        };
        Returns: string;
      };
      meu_portal_token: { Args: Record<string, never>; Returns: string | null };
      portal_cliente_publico: { Args: { p_token: string }; Returns: Json };
      responder_revisao_portal: {
        Args: {
          p_token: string;
          p_review_id: string;
          p_decision: "approved" | "changes_requested";
          p_feedback: string | null;
          p_client_name: string | null;
        };
        Returns: boolean;
      };
      criar_lead_comercial: {
        Args: {
          p_empresa_nome: string;
          p_contato_nome: string;
          p_contato_email?: string | null;
          p_contato_telefone?: string | null;
          p_valor?: number;
          p_responsavel?: string;
          p_temperatura?: string;
          p_origem?: string;
          p_cidade?: string | null;
          p_segmento?: string | null;
        };
        Returns: { lead_id: string; cliente_id: string; contato_id: string };
      };
      arquivar_lead_comercial: {
        Args: { p_lead_id: string; p_motivo?: string | null };
        Returns: Database["public"]["Tables"]["leads"]["Row"];
      };
      restaurar_lead_comercial: {
        Args: { p_lead_id: string };
        Returns: Database["public"]["Tables"]["leads"]["Row"];
      };
      excluir_lead_comercial: {
        Args: { p_lead_id: string };
        Returns: boolean;
      };
      mover_lead_comercial: {
        Args: { p_lead_id: string; p_etapa: string };
        Returns: Database["public"]["Tables"]["leads"]["Row"];
      };
      fechar_lead_comercial: {
        Args: {
          p_lead_id: string;
          p_criar_proposta?: boolean;
          p_criar_contrato?: boolean;
          p_criar_projeto?: boolean;
          p_criar_cobranca?: boolean;
          p_promover_cliente?: boolean;
          p_agendar_onboarding?: boolean;
        };
        Returns: {
          lead_id: string;
          criados: string[];
          pulados: string[];
          proposta_id: string | null;
          contrato_id: string | null;
          projeto_id: string | null;
          financeiro_id: string | null;
          onboarding_id: string | null;
        };
      };
    };
  };
}
