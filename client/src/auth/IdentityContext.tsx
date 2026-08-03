import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listEmployees, type Employee } from "../api/client";

/**
 * Stands in for real auth. The server resolves the current user from an
 * `x-employee-id` header, so "signing in" here is just choosing which seeded
 * employee id to send. The choice is persisted so deep links and reloads keep
 * the same user.
 */

const STORAGE_KEY = "ascendx.employeeId";

interface IdentityValue {
  me: Employee | null;
  employees: Employee[];
  directReports: Employee[];
  isManager: boolean;
  loading: boolean;
  error: string | null;
  setMeId: (id: string) => void;
  retry: () => void;
}

const IdentityContext = createContext<IdentityValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meId, setMeIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listEmployees()
      .then(({ employees: loaded }) => {
        if (cancelled) return;
        setEmployees(loaded);
        setMeIdState((current) => {
          if (current && loaded.some((e) => e.id === current)) return current;
          // Default to a manager so a reviewer lands on an account that can see
          // every route rather than a subset.
          const manager = loaded.find((e) => loaded.some((r) => r.managerId === e.id));
          return manager?.id ?? loaded[0]?.id ?? null;
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  useEffect(() => {
    if (meId) localStorage.setItem(STORAGE_KEY, meId);
  }, [meId]);

  const setMeId = useCallback((id: string) => setMeIdState(id), []);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<IdentityValue>(() => {
    const me = employees.find((e) => e.id === meId) ?? null;
    const directReports = me ? employees.filter((e) => e.managerId === me.id) : [];
    return {
      me,
      employees,
      directReports,
      isManager: directReports.length > 0,
      loading,
      error,
      setMeId,
      retry,
    };
  }, [employees, meId, loading, error, setMeId, retry]);

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used inside IdentityProvider");
  return ctx;
}

/** Narrowed accessor for pages that only render once a user is resolved. */
export function useCurrentUser(): Employee {
  const { me } = useIdentity();
  if (!me) throw new Error("useCurrentUser used before identity resolved");
  return me;
}
