import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type OperatorSession = {
  id: string;
  name: string;
  role: string | null;
  pin?: string; // kept in localStorage to authorize server-side writes via RPC
  is_admin?: boolean;
};

type Ctx = {
  operator: OperatorSession | null;
  signIn: (op: OperatorSession) => void;
  signOut: () => void;
};

const KEY = "haccp.operator";
const OperatorCtx = createContext<Ctx>({ operator: null, signIn: () => {}, signOut: () => {} });

export function OperatorSessionProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<OperatorSession | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setOperator(JSON.parse(raw));
    } catch {}
  }, []);

  const signIn = useCallback((op: OperatorSession) => {
    localStorage.setItem(KEY, JSON.stringify(op));
    setOperator(op);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    setOperator(null);
  }, []);

  return (
    <OperatorCtx.Provider value={{ operator, signIn, signOut }}>
      {children}
    </OperatorCtx.Provider>
  );
}

export const useOperatorSession = () => useContext(OperatorCtx);