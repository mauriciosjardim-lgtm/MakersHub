import { createFileRoute, Link } from "@tanstack/react-router";
import { LogoMakersHub } from "@/components/logo-makershub";

// ⚠️ Minuta preenchida com dados reais (Rastro Visual LTDA) — ainda pendente
// de revisão por advogado antes de escalar as vendas.
export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — MakersHub" }] }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <DocumentoLegal titulo="Termos de Uso" atualizadoEm="14 de setembro de 2026">
      <S n="1" t="Aceitação">
        Ao criar uma conta ou utilizar o MakersHub ("Plataforma"), você concorda com estes Termos de
        Uso e com a nossa{" "}
        <Link to="/privacidade" className="text-primary hover:underline">
          Política de Privacidade
        </Link>
        . Se você não concorda, não utilize a Plataforma. A Plataforma é operada por RASTRO VISUAL
        LTDA, inscrita no CNPJ sob nº 42.503.639/0001-30 ("nós").
      </S>
      <S n="2" t="O serviço">
        O MakersHub é uma plataforma de gestão para produtoras de audiovisual, videomakers e
        criadores de conteúdo, reunindo CRM, orçamentos, contratos, projetos, agenda e financeiro. A
        Plataforma é fornecida "como está" e evolui continuamente — recursos podem ser adicionados,
        alterados ou descontinuados, sempre buscando preservar seus dados.
      </S>
      <S n="3" t="Cadastro e conta">
        Você é responsável pela veracidade dos dados informados no cadastro e pela guarda das suas
        credenciais de acesso. Contas são pessoais; o compartilhamento de senha é vedado. Membros
        convidados para um workspace acessam apenas os módulos autorizados pelo administrador da
        conta.
      </S>
      <S n="4" t="Planos e pagamento">
        O acesso à Plataforma se dá por período de teste gratuito ou por assinatura paga, conforme
        os valores e condições divulgados em nosso site no momento da contratação. Os pagamentos são
        processados por parceiros de pagamento (atualmente Asaas Gestão Financeira S.A.). A não
        renovação do pagamento ao fim do período contratado suspende o acesso, mas não apaga os seus
        dados imediatamente.
      </S>
      <S n="5" t="Conteúdo do usuário">
        Os dados que você insere na Plataforma (clientes, projetos, lançamentos financeiros,
        contratos, arquivos) são seus. Nós não reivindicamos propriedade sobre eles e os tratamos
        conforme a Política de Privacidade. Você declara ter o direito de inserir esses dados e nos
        isenta de responsabilidade sobre o conteúdo gerado por você, incluindo contratos emitidos
        pela Plataforma entre você e seus clientes.
      </S>
      <S n="5.1" t="Google Agenda">
        A integração opcional com o Google Agenda permite sincronizar eventos atuais e futuros entre
        sua agenda principal e o MakersHub. As ações realizadas em um serviço podem criar, alterar
        ou excluir o evento correspondente no outro. Você pode desconectar a integração a qualquer
        momento em Configurações. O tratamento desses dados está detalhado na nossa{" "}
        <Link to="/privacidade" className="text-primary hover:underline">
          Política de Privacidade
        </Link>
        . Google Agenda é um serviço fornecido pela Google LLC e sujeito aos termos próprios do
        Google.
      </S>
      <S n="6" t="Uso aceitável">
        É vedado: (a) usar a Plataforma para atividade ilícita; (b) tentar acessar dados de outras
        contas; (c) sobrecarregar, sondar ou burlar mecanismos de segurança; (d) revender ou
        sublicenciar o acesso sem autorização por escrito. Violações podem resultar em suspensão ou
        encerramento da conta.
      </S>
      <S n="7" t="Documentos gerados pela Plataforma">
        Modelos de contrato, cláusulas e orçamentos gerados pela Plataforma são ferramentas de apoio
        e não constituem aconselhamento jurídico ou contábil. Recomendamos a revisão por
        profissional habilitado antes do uso em negócios relevantes.
      </S>
      <S n="8" t="Disponibilidade e responsabilidade">
        Empregamos esforços comerciais razoáveis para manter a Plataforma disponível e segura, mas
        não garantimos operação ininterrupta. Na máxima extensão permitida pela lei, nossa
        responsabilidade total limita-se ao valor pago por você nos 12 (doze) meses anteriores ao
        evento que der origem à reclamação.
      </S>
      <S n="9" t="Cancelamento">
        Você pode cancelar a qualquer momento. Em compras online, aplica-se o direito de
        arrependimento de 7 (sete) dias corridos a partir da contratação (art. 49 do CDC), com
        reembolso integral. Após o cancelamento, seus dados ficam disponíveis para exportação por 30
        (trinta) dias antes da exclusão definitiva.
      </S>
      <S n="10" t="Alterações destes termos">
        Podemos atualizar estes Termos; mudanças relevantes serão comunicadas por e-mail ou aviso na
        Plataforma com antecedência mínima de 15 (quinze) dias. O uso continuado após a vigência das
        alterações constitui aceite.
      </S>
      <S n="11" t="Foro e contato">
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de Porto
        Alegre/RS, salvo disposição legal em contrário. Dúvidas:{" "}
        <a href="mailto:equipe@makershub.app.br" className="text-primary hover:underline">
          equipe@makershub.app.br
        </a>
        .
      </S>
    </DocumentoLegal>
  );
}

export function DocumentoLegal({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-[720px]">
        <Link to="/home" className="inline-flex items-center gap-2.5">
          <LogoMakersHub className="h-8 w-8" />
          <span className="font-display text-base font-semibold">
            <span className="text-foreground">Makers</span>
            <span className="text-primary">Hub</span>
          </span>
        </Link>
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Última atualização: {atualizadoEm}</p>
        <div className="mt-8 space-y-7">{children}</div>
        <p className="mt-12 border-t border-border/40 pt-6 text-xs text-muted-foreground">
          MakersHub — o hub completo para produtoras de audiovisual.{" "}
          <Link to="/termos" className="text-primary hover:underline">
            Termos de Uso
          </Link>{" "}
          ·{" "}
          <Link to="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
        </p>
      </div>
    </div>
  );
}

export function S({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold text-foreground">
        {n}. {t}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
