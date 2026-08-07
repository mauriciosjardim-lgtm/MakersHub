import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { configureMakersMembers } from "@/lib/client-reviews";
import { useAuth } from "@/lib/auth";
import { portalSlug } from "@/lib/portal-cliente";
import {
  createPortalClientUser,
  listPortalClientUsers,
  setPortalClientUserStatus,
  type PortalClientUser,
} from "@/lib/portal-client-users";
import { cn } from "@/lib/utils";

export function ClientPortalUsersPanel({
  clientId,
  clientName,
  navigation,
}: {
  clientId?: string;
  clientName: string;
  navigation?: ReactNode;
}) {
  const { empresa } = useAuth();
  const [users, setUsers] = useState<PortalClientUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    accessUrl: string;
  } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current;
    if (!clientId) {
      setUsers([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const nextUsers = await listPortalClientUsers(clientId);
      if (requestId === loadRequest.current) setUsers(nextUsers);
    } catch (error) {
      if (requestId === loadRequest.current) {
        setUsers([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os acessos do cliente",
        );
        toast.error("Não foi possível carregar os acessos do cliente");
      }
    } finally {
      if (requestId === loadRequest.current) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    // Credenciais são dados sensíveis e específicos de um cliente. Nunca
    // permita que o modal/mensagem sobreviva a uma troca de cliente.
    setDialog(false);
    setCredentials(null);
    setForm({ name: "", email: "", password: "" });
    setShowPassword(false);
    void load();
  }, [clientId, load]);

  const openCreate = () => {
    setForm({
      name: "",
      email: "",
      password: `Makers#${crypto.randomUUID().slice(0, 8)}`,
    });
    setCredentials(null);
    setShowPassword(false);
    setDialog(true);
  };

  const createUser = async () => {
    if (!clientId) return;
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      toast.error("Preencha nome, e-mail e uma senha com pelo menos 8 caracteres");
      return;
    }
    setCreating(true);
    try {
      const createdAccessUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/portal/${portalSlug(clientName)}`
          : `/portal/${portalSlug(clientName)}`;
      await configureMakersMembers({ clientId, enabled: true });
      await createPortalClientUser({
        clientId,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setCredentials({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        accessUrl: createdAccessUrl,
      });
      await load();
      toast.success("Usuário do cliente criado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o usuário");
    } finally {
      setCreating(false);
    }
  };

  const toggleUser = async (user: PortalClientUser) => {
    if (changingUserId) return;
    setChangingUserId(user.id);
    try {
      await setPortalClientUserStatus(user.id, user.status === "active" ? "inactive" : "active");
      await load();
      toast.success(user.status === "active" ? "Acesso revogado" : "Acesso reativado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o acesso");
    } finally {
      setChangingUserId(null);
    }
  };

  const producerName = empresa?.nome?.trim();
  const invitationMessage = credentials
    ? [
        `Olá, ${credentials.name}! 👋`,
        "",
        producerName
          ? `A ${producerName} preparou um portal exclusivo para você.`
          : "Preparamos um portal exclusivo para você.",
        "",
        "Por lá você poderá acompanhar o andamento dos projetos, revisar materiais e acessar todas as entregas em um só lugar.",
        "",
        `🔗 Acesse: ${credentials.accessUrl}`,
        `📧 Login: ${credentials.email}`,
        `🔐 Senha temporária: ${credentials.password}`,
        "",
        "Guarde estes dados para os próximos acessos. Se precisar de qualquer coisa, fale com a nossa equipe. 🎬",
        ...(producerName ? ["", `— Equipe ${producerName}`] : []),
      ].join("\n")
    : "";

  const copyInvitation = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(invitationMessage);
      toast.success("Mensagem para o cliente copiada");
    } catch {
      toast.error("Não foi possível copiar a mensagem");
    }
  };

  if (!clientId) {
    return (
      <section className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
        <p className="text-xs font-semibold text-warning">Cliente ainda não vinculado ao CRM</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Vincule o projeto ao cliente para criar usuários de acesso.
        </p>
      </section>
    );
  }

  const activeUsers = users.filter((user) => user.status === "active").length;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-white/[.075] bg-white/[.022]">
        {navigation && (
          <div className="border-b border-white/[.07] bg-black/[.08]">{navigation}</div>
        )}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[.07] p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-[#66B8FF]/25 bg-[#66B8FF]/10 text-[#66B8FF] shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_0_22px_-14px_currentColor]">
              <KeyRound className="size-[18px]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold">Pessoas com acesso</h3>
                {activeUsers > 0 && (
                  <span className="rounded-full bg-success/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
                    {activeUsers} ativo{activeUsers === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Logins ativos de {clientName}.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="h-10 rounded-xl px-4">
              <a href="/portal/login" target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> Tela de login
              </a>
            </Button>
            <Button className="h-10 rounded-xl px-4 font-bold" onClick={openCreate}>
              <UserPlus className="size-3.5" /> Novo usuário
            </Button>
          </div>
        </header>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="grid min-h-28 place-items-center rounded-xl border border-destructive/25 bg-destructive/[0.035] text-center"
            >
              <div>
                <p className="text-sm font-semibold">Não foi possível carregar os acessos</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : users.length ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex flex-col items-stretch justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center",
                    user.status === "active"
                      ? "border-success/20 bg-success/[0.04]"
                      : "border-border/60 bg-background/20 opacity-65",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
                      <UserRound className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{user.name}</p>
                        {user.status === "active" && (
                          <ShieldCheck className="size-3 text-success" />
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <Mail className="size-3" /> {user.email}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {user.lastAccessAt
                          ? `Último acesso ${new Date(user.lastAccessAt).toLocaleString("pt-BR")}`
                          : "Ainda não acessou"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void toggleUser(user)}
                    disabled={Boolean(changingUserId)}
                    className={cn(
                      "self-end sm:self-auto",
                      user.status === "active"
                        ? "text-muted-foreground hover:text-destructive"
                        : "text-success",
                    )}
                  >
                    {changingUserId === user.id ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Salvando
                      </>
                    ) : user.status === "active" ? (
                      <>
                        <Ban className="size-3.5" /> Revogar
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" /> Reativar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={openCreate}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-4 text-left transition hover:bg-primary/[0.07]"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                  <UserPlus className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Nenhum usuário criado</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Crie o primeiro login com e-mail e senha.
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold text-primary">Criar acesso →</span>
            </button>
          )}
        </div>
      </section>

      <Dialog
        open={dialog}
        onOpenChange={(open) => {
          if (!creating) setDialog(open);
        }}
      >
        <DialogContent
          className={cn(
            "kb-form-dialog overflow-hidden p-0",
            credentials ? "sm:max-w-lg" : "sm:max-w-md",
          )}
        >
          <DialogHeader className="kb-form-header border-b border-white/[.07] px-5 py-5 pr-14">
            <DialogTitle className="font-display text-xl font-bold tracking-[-.02em]">
              {credentials ? "Acesso criado" : "Novo usuário do cliente"}
            </DialogTitle>
          </DialogHeader>

          {credentials ? (
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-success/25 bg-success/[0.06] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-success">
                  <CheckCircle2 className="size-4" /> Usuário pronto para entrar
                </p>
                <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-background/35 p-3 text-xs">
                  <p>
                    <span className="text-muted-foreground">Login:</span> {credentials.email}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Senha:</span> {credentials.password}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Acesso:</span> {credentials.accessUrl}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-border/70 bg-background/35">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <MessageCircle className="size-3.5 text-success" />
                      Mensagem pronta para o WhatsApp
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Já inclui o link, o login e a senha temporária.
                    </p>
                  </div>
                  <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                    Pronta
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-foreground/85">
                  {invitationMessage}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={copyInvitation}>
                  <Copy className="size-3.5" /> Copiar mensagem
                </Button>
                <Button className="bg-success text-black hover:bg-success/90" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(invitationMessage)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-3.5" /> Abrir no WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-5 py-5">
              <p className="rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-xs text-muted-foreground">
                Cliente: <strong className="text-foreground">{clientName}</strong>
              </p>
              <Field label="Nome da pessoa">
                <Input
                  className="kb-form-control"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex.: Marina Souza"
                />
              </Field>
              <Field label="E-mail de acesso">
                <Input
                  className="kb-form-control"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="marina@cliente.com"
                />
              </Field>
              <Field label="Senha temporária">
                <span className="relative block">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    className="kb-form-control pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </span>
              </Field>
            </div>
          )}

          <DialogFooter className="kb-form-footer border-t border-white/[.07] px-5 py-4">
            {credentials ? (
              <Button variant="outline" onClick={() => setDialog(false)}>
                Concluir
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialog(false)} disabled={creating}>
                  Cancelar
                </Button>
                <Button onClick={() => void createUser()} disabled={creating}>
                  {creating && <Loader2 className="size-3.5 animate-spin" />} Criar usuário
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="kb-form-label">{label}</span>
      {children}
    </label>
  );
}
