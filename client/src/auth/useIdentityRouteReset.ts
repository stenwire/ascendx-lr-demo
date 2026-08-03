import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIdentity } from "./IdentityContext";

/**
 * Routes pinned to one record. The id in the URL belongs to whoever was signed
 * in when it was opened, so it stops being meaningful the moment the signed-in
 * employee changes — the page would keep showing the previous person's record.
 */
const RECORD_ROUTES: { pattern: RegExp; collection: string }[] = [
  // /requests/<id>, but not the /requests/new form.
  { pattern: /^\/requests\/(?!new$)[^/]+\/?$/, collection: "/requests" },
];

/**
 * Sends the viewer back to the collection when they switch employee while
 * looking at a single record. Manager-only routes are already handled by their
 * own guard, and pages that read the current user from context re-render on
 * their own; this covers the one case neither does.
 */
export function useIdentityRouteReset(): void {
  const { me } = useIdentity();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const previousId = useRef<string | null>(null);

  useEffect(() => {
    const currentId = me?.id ?? null;
    const previous = previousId.current;
    previousId.current = currentId;

    // Identity resolving for the first time is not a switch.
    if (!previous || !currentId || previous === currentId) return;

    const match = RECORD_ROUTES.find((route) => route.pattern.test(pathname));
    if (match) navigate(match.collection, { replace: true });
  }, [me?.id, pathname, navigate]);
}
