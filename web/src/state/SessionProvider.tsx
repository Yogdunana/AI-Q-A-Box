import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Credentials, type QuestionBox, type RegisterInput, type Session, type User } from "../api";
import { clearOwnerDrafts } from "../lib/owner-draft";
import { SessionContext, type SessionContextValue } from "./session";
import { clearQueries } from "../lib/query";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionContextValue["status"]>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getSession().then(
      (result) => {
        if (cancelled) return;
        setSession(result);
        setStatus("ready");
      },
      () => !cancelled && setStatus("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const login = useCallback(async (input: Credentials) => {
    const result = await api.login(input);
    clearOwnerDrafts();
    clearQueries();
    setSession(result);
    return result;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await api.register(input);
    clearOwnerDrafts();
    clearQueries();
    setSession(result);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    clearOwnerDrafts();
    clearQueries();
    setSession(null);
  }, []);

  const setBox = useCallback((box: QuestionBox) => {
    setSession((current) => (current ? { ...current, box } : current));
  }, []);

  const setUser = useCallback((user: User) => {
    setSession((current) => (current ? { ...current, user } : current));
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ status, session, login, register, logout, setBox, setUser, retry }),
    [status, session, login, register, logout, setBox, setUser, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
