import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { useProfileStore } from './stores/profileStore'
import { useWorkspaceStore } from './stores/workspaceStore'

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerificationPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const InviteCodePage = lazy(() => import('./pages/InviteCodePage'));
const InviteLinkPage = lazy(() => import('./pages/InviteLinkPage'));
const ProfileOnboardingPage = lazy(() => import('./pages/ProfileOnboardingPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const SavedPostsPage = lazy(() => import('./pages/SavedPostsPage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
const UpgradeSuccessPage = lazy(() => import('./pages/UpgradeSuccessPage'));
const UpgradeCancelPage = lazy(() => import('./pages/UpgradeCancelPage'));
const JoinCommunityPage = lazy(() => import('./pages/JoinCommunityPage'));
const ServerSettingsPage = lazy(() => import('./pages/ServerSettingsPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));

// ── Route Guards ───────────────────────────────────────────────────────────

/** Redirect authenticated users away from auth pages → onboarding or feed */
const RedirectIfAuthenticated = ({ children }) => {
  const { user, isCheckingAuth } = useAuthStore();
  const { profile } = useProfileStore();
  if (isCheckingAuth) return null;
  if (user?.isInviteVerified) {
    // If profile not onboarded yet → go to onboarding, else feed
    if (profile && !profile.isOnboarded) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/feed" replace />;
  }
  return children;
};

/** Require auth + invite verified */
const ProtectedRoute = ({ children }) => {
  const { user, isCheckingAuth } = useAuthStore();
  if (isCheckingAuth) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isInviteVerified) return <Navigate to="/invite" replace />;
  return children;
};

/** Require auth + invite + completed onboarding */
const RequireOnboarding = ({ children }) => {
  const { user, isCheckingAuth } = useAuthStore();
  const { profile } = useProfileStore();
  if (isCheckingAuth) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isInviteVerified) return <Navigate to="/invite" replace />;
  // If profile loaded and not onboarded → redirect to onboarding
  if (profile && !profile.isOnboarded) return <Navigate to="/onboarding" replace />;
  return children;
};


const App = () => {
  const { checkAuth, user, isCheckingAuth } = useAuthStore();
  const { fetchProfile } = useProfileStore();
  const { initFromMemberships } = useWorkspaceStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch profile once user is loaded and invite-verified
  useEffect(() => {
    if (user?._id && user?.isInviteVerified) {
      fetchProfile(user._id);
      // Initialize workspace from memberships
      if (user.memberships?.length > 0) {
        initFromMemberships(user.memberships);
      }
    }
  }, [user, fetchProfile, initFromMemberships]);

  // Loading spinner while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-3 border-warm-yellow border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Suspense
        fallback={(
          <div className="min-h-screen min-h-[100dvh] bg-discord-darkest flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-3 border-blurple border-t-transparent animate-spin" />
          </div>
        )}
      >
      <Routes>
        {/* Public */}
        <Route path='/' element={<HomePage />} />

        {/* Invite — public entry point */}
        <Route path='/invite' element={<RedirectIfAuthenticated><InviteCodePage /></RedirectIfAuthenticated>} />
        <Route path='/invite-link' element={<InviteLinkPage />} />

        {/* Auth pages — signup requires invite code in sessionStorage */}
        <Route path='/signup' element={<RedirectIfAuthenticated><SignupPage /></RedirectIfAuthenticated>} />
        <Route path='/login' element={<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>} />
        <Route path='/verify-email' element={<EmailVerificationPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route path='/reset-password/:token' element={<ResetPasswordPage />} />

        {/* Onboarding — must be logged in + invite verified */}
        <Route path='/onboarding' element={<ProtectedRoute><ProfileOnboardingPage /></ProtectedRoute>} />

        {/* Feed — must be logged in + invite verified + onboarded */}
        <Route path='/feed' element={<RequireOnboarding><FeedPage /></RequireOnboarding>} />

        {/* Saved Posts — any logged-in + onboarded user */}
        <Route path='/saved' element={<RequireOnboarding><SavedPostsPage /></RequireOnboarding>} />

        {/* Join Community — any logged-in + onboarded user */}
        <Route path='/join-community' element={<RequireOnboarding><JoinCommunityPage /></RequireOnboarding>} />

        {/* Membership upgrade */}
        <Route path='/upgrade' element={<RequireOnboarding><UpgradePage /></RequireOnboarding>} />
        <Route path='/upgrade/success' element={<RequireOnboarding><UpgradeSuccessPage /></RequireOnboarding>} />
        <Route path='/upgrade/cancel' element={<RequireOnboarding><UpgradeCancelPage /></RequireOnboarding>} />
        <Route path='/server-settings' element={<RequireOnboarding><ServerSettingsPage /></RequireOnboarding>} />
        <Route path='/help' element={<RequireOnboarding><HelpPage /></RequireOnboarding>} />

        {/* Catch-all */}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
      </Suspense>
    </div>
  )
}

export default App
