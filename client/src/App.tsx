import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ConnectionBanner } from './components/ConnectionBanner';
import { Spinner } from './components/ui';
import { useAuth } from './context/AuthContext';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuizEditor = lazy(() => import('./pages/QuizEditor'));
const AIGenerate = lazy(() => import('./pages/AIGenerate'));
const Host = lazy(() => import('./pages/Host'));
const Join = lazy(() => import('./pages/Join'));
const Play = lazy(() => import('./pages/Play'));
const Profile = lazy(() => import('./pages/Profile'));
const History = lazy(() => import('./pages/History'));

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Spinner className="h-7 w-7" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { pathname } = useLocation();
  const fullscreen = pathname.startsWith('/play') || pathname.startsWith('/host/');
  return (
    <div className="min-h-dvh">
      <ConnectionBanner />
      {!fullscreen && <Navbar />}
      <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><Spinner className="h-7 w-7" /></div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/join" element={<Join />} />
          <Route path="/play/:pin" element={<Play />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/quiz/new" element={<Protected><QuizEditor /></Protected>} />
          <Route path="/quiz/:id" element={<Protected><QuizEditor /></Protected>} />
          <Route path="/generate" element={<Protected><AIGenerate /></Protected>} />
          <Route path="/host/:quizId" element={<Protected><Host /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
