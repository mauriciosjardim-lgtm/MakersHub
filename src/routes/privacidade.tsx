import { createFileRoute, Link } from "@tanstack/react-router";
import { DocumentoLegal, S } from "./termos";

// ⚠️ Minuta preenchida com dados reais (Rastro Visual LTDA) — ainda pendente
// de revisão por advogado antes de escalar as vendas.
export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — MakersHub" }] }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <DocumentoLegal titulo="Política de Privacidade" atualizadoEm="30 de julho de 2026">
      <S n="1" t="Quem somos">
        Esta Política descreve como o MakersHub, operado por RASTRO VISUAL LTDA (CNPJ
        42.503.639/0001-30), trata dados pessoais, na condição de controladora, em conformidade com
        a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
      </S>
      <S n="2" t="Dados que coletamos">
        (a) <strong>Cadastro:</strong> nome, e-mail, WhatsApp e tipo de operação; (b){" "}
        <strong>Pagamento:</strong> CPF/CNPJ, telefone e dados de cobrança — dados de cartão são
        processados diretamente pelo parceiro de pagamento e não ficam armazenados conosco; (c){" "}
        <strong>Uso da Plataforma:</strong> registros de acesso (IP, data/hora) exigidos pelo Marco
        Civil da Internet; (d) <strong>Dados inseridos por você:</strong> informações dos seus
        clientes, projetos, finanças e contratos — nestes, atuamos como operadora e você é o
        controlador.
      </S>
      <S n="3" t="Para que usamos">
        Prestar o serviço contratado, processar pagamentos, prestar suporte relacionado à compra,
        enviar comunicações transacionais (confirmações, redefinição de senha, convites de equipe),
        dar suporte, cumprir obrigações legais e melhorar a Plataforma. O telefone informado no
        checkout não é usado para abordar compras abandonadas ou enviar marketing. Não vendemos
        dados pessoais.
      </S>
      <S n="4" t="Com quem compartilhamos">
        Somente com operadores necessários à prestação do serviço: infraestrutura e banco de dados
        (Supabase), hospedagem e rede (Cloudflare), processamento de pagamentos (Asaas), envio de
        e-mails (Resend) e mensuração de conversões (Meta). Todos sob contratos que exigem proteção
        adequada. Dados podem ser transferidos internacionalmente para esses provedores, com
        salvaguardas da LGPD.
      </S>
      <S n="5" t="Segurança">
        Adotamos criptografia em trânsito (HTTPS/TLS), controle de acesso por empresa (isolamento
        multi-tenant), senhas com hash e princípio do menor privilégio. Nenhum sistema é infalível;
        incidentes relevantes serão comunicados conforme a LGPD.
      </S>
      <S n="6" t="Retenção">
        Mantemos seus dados enquanto a conta estiver ativa. Após o cancelamento, ficam disponíveis
        para exportação por 30 (trinta) dias e são então excluídos, salvo dados que devamos reter
        por obrigação legal (ex.: registros fiscais e de acesso).
      </S>
      <S n="7" t="Seus direitos (LGPD)">
        Você pode solicitar: confirmação de tratamento, acesso, correção, anonimização,
        portabilidade, exclusão, informação sobre compartilhamentos e revogação de consentimento.
        Basta escrever para{" "}
        <a href="mailto:equipe@makershub.app.br" className="text-primary hover:underline">
          equipe@makershub.app.br
        </a>{" "}
        — respondemos nos prazos da LGPD.
      </S>
      <S n="8" t="Cookies">
        Usamos cookies essenciais ao funcionamento (sessão e preferência de interface) e tecnologias
        de mensuração para entender a conversão das páginas de venda. Eventos de checkout não
        incluem CPF, telefone, senha, tokens ou dados de cartão.
      </S>
      <S n="9" t="Encarregado (DPO) e atualizações">
        Encarregado pelo tratamento de dados: Mauricio Jardim —{" "}
        <a href="mailto:equipe@makershub.app.br" className="text-primary hover:underline">
          equipe@makershub.app.br
        </a>
        . Esta Política pode ser atualizada; a versão vigente estará sempre nesta página, com a data
        de atualização no topo. Ver também os{" "}
        <Link to="/termos" className="text-primary hover:underline">
          Termos de Uso
        </Link>
        .
      </S>
    </DocumentoLegal>
  );
}
