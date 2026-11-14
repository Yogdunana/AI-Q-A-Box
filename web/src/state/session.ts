import { createContext, useContext } from "react";
import type { Credentials, QuestionBox, RegisterInput, Session, User } from "../api";

export interface SessionContextValue {
  status: "loading" | "ready" | "error";
  session: Session | null;
  login(input: Credentials): Promise<Session>;
  register(input: RegisterInput): Promise<Session>;
  logout(): Promise<void>;
  setBox(box: QuestionBox): void;
  setUser(user: User): void;
  retry(): void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** For routes behind OwnerLayout, where a session and box are guaranteed. */
export function useOwner() {
  const { session } = useSession();
  if (!session?.box) throw new Error("useOwner requires an authenticated owner with a box");
  return { user: session.user, box: session.box };
}
