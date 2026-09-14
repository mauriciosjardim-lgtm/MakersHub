import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarError, type Connection, type OAuthState, type Owner } from "./protocol";

export interface CalendarRepository {
  sessionActive(owner: Owner): Promise<boolean>;
  begin(state: OAuthState): Promise<void>;
  consume(stateHash: string, browserHash: string): Promise<OAuthState | null>;
  connection(owner: Owner): Promise<Connection | null>;
  save(owner: Owner, generation: string, ciphertext: string, email: string): Promise<boolean>;
  remove(owner: Owner, generation: string): Promise<void>;
  markRevoking(owner: Owner, generation: string): Promise<void>;
  claimRefresh(owner: Owner, generation: string, lock: string): Promise<boolean>;
  finishRefresh(
    owner: Owner,
    generation: string,
    lock: string,
    ciphertext: string,
  ): Promise<boolean>;
  releaseRefresh(owner: Owner, generation: string, lock: string, reconnect: boolean): Promise<void>;
}
function checked(error: unknown) {
  if (error) throw new CalendarError("storage_unavailable", 503);
}

export class SupabaseCalendarRepository implements CalendarRepository {
  constructor(private db: SupabaseClient) {}
  async sessionActive(owner: Owner): Promise<boolean> {
    const { data, error } = await this.db.rpc("google_calendar_session_active", {
      p_user_id: owner.userId,
      p_empresa_id: owner.empresaId,
      p_session_id: owner.sessionId,
    });
    checked(error);
    return data === true;
  }
  async begin(s: OAuthState) {
    const { error } = await this.db.rpc("google_calendar_begin_oauth", {
      p_state_hash: s.state_hash,
      p_browser_hash: s.browser_hash,
      p_user_id: s.user_id,
      p_empresa_id: s.empresa_id,
      p_session_id: s.session_id,
      p_generation: s.generation,
      p_verifier_ciphertext: s.verifier_ciphertext,
      p_expires_at: s.expires_at,
    });
    checked(error);
  }
  async consume(stateHash: string, browserHash: string): Promise<OAuthState | null> {
    const { data, error } = await this.db
      .from("google_calendar_oauth_states")
      .delete()
      .eq("state_hash", stateHash)
      .eq("browser_hash", browserHash)
      .gt("expires_at", new Date().toISOString())
      .select()
      .maybeSingle();
    checked(error);
    return data as OAuthState | null;
  }
  async connection(o: Owner): Promise<Connection | null> {
    const { data, error } = await this.db
      .from("google_calendar_connections")
      .select()
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .maybeSingle();
    checked(error);
    return data as Connection | null;
  }
  async save(o: Owner, generation: string, ciphertext: string, email: string) {
    const { data, error } = await this.db
      .from("google_calendar_connections")
      .update({
        tokens_ciphertext: ciphertext,
        google_email: email,
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation)
      .eq("status", "pending")
      .select("user_id")
      .maybeSingle();
    checked(error);
    return Boolean(data);
  }
  async remove(o: Owner, generation: string) {
    const stateResult = await this.db
      .from("google_calendar_oauth_states")
      .delete()
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation);
    checked(stateResult.error);
    const { error } = await this.db
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation);
    checked(error);
  }
  async markRevoking(o: Owner, generation: string) {
    const { error } = await this.db
      .from("google_calendar_connections")
      .update({ status: "revoking", updated_at: new Date().toISOString() })
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation);
    checked(error);
  }
  async claimRefresh(o: Owner, generation: string, lock: string) {
    const { data, error } = await this.db
      .from("google_calendar_connections")
      .update({
        refresh_lock: lock,
        refresh_lock_until: new Date(Date.now() + 60000).toISOString(),
      })
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation)
      .eq("status", "connected")
      .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${new Date().toISOString()}`)
      .select("user_id")
      .maybeSingle();
    checked(error);
    return Boolean(data);
  }
  async finishRefresh(o: Owner, generation: string, lock: string, ciphertext: string) {
    const { data, error } = await this.db
      .from("google_calendar_connections")
      .update({
        tokens_ciphertext: ciphertext,
        refresh_lock: null,
        refresh_lock_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation)
      .eq("status", "connected")
      .eq("refresh_lock", lock)
      .select("user_id")
      .maybeSingle();
    checked(error);
    return Boolean(data);
  }
  async releaseRefresh(o: Owner, generation: string, lock: string, reconnect: boolean) {
    const { error } = await this.db
      .from("google_calendar_connections")
      .update({
        refresh_lock: null,
        refresh_lock_until: null,
        ...(reconnect ? { status: "reconnect_required" } : {}),
      })
      .eq("user_id", o.userId)
      .eq("empresa_id", o.empresaId)
      .eq("generation", generation)
      .eq("status", "connected")
      .eq("refresh_lock", lock);
    checked(error);
  }
}
