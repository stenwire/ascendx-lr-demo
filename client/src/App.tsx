import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { IdentityProvider, useIdentity } from "./auth/IdentityContext";
import { AppLayout } from "./components/layout/AppLayout";
import { WalkthroughProvider } from "./walkthrough/WalkthroughContext";
import { AccountPage } from "./pages/AccountPage";
import { HelpPage } from "./pages/HelpPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { MyRequestsPage } from "./pages/MyRequestsPage";
import { NewRequestPage } from "./pages/NewRequestPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RequestDetailPage } from "./pages/RequestDetailPage";
import { TeamPage } from "./pages/TeamPage";

/**
 * Identity resolves asynchronously, and AppLayout holds the render until it has.
 * By the time a guarded route renders, isManager is trustworthy — so a manager
 * deep-linking to /approvals is never bounced on a cold load.
 */
function RequireManager({ children }: { children: JSX.Element }) {
  const { isManager } = useIdentity();
  return isManager ? children : <Navigate to="/" replace />;
}

export function App() {
  return (
    <IdentityProvider>
      <BrowserRouter>
        <WalkthroughProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="requests" element={<MyRequestsPage />} />
              <Route path="requests/new" element={<NewRequestPage />} />
              <Route path="requests/:id" element={<RequestDetailPage />} />
              <Route
                path="approvals"
                element={
                  <RequireManager>
                    <ApprovalsPage />
                  </RequireManager>
                }
              />
              <Route
                path="team"
                element={
                  <RequireManager>
                    <TeamPage />
                  </RequireManager>
                }
              />
              <Route path="account" element={<AccountPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </WalkthroughProvider>
      </BrowserRouter>
    </IdentityProvider>
  );
}
