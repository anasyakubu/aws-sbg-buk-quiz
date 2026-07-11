import { Link, useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, UserRound, History } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.07] bg-paper/85 backdrop-blur dark:border-ink-line dark:bg-ink/85">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to={user ? '/dashboard' : '/'} aria-label="SBG BUK Quiz home"><Logo /></Link>
        <nav className="flex items-center gap-1.5">
          <button onClick={toggle} className="btn-ghost !min-h-0 !px-2.5 !py-2" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          {user ? (
            <>
              <Link to="/history" className="btn-ghost !min-h-0 !px-2.5 !py-2" aria-label="Score history"><History className="h-[18px] w-[18px]" /></Link>
              <Link to="/profile" className="btn-ghost !min-h-0 !px-2.5 !py-2" aria-label="Profile"><UserRound className="h-[18px] w-[18px]" /></Link>
              <button onClick={() => { signOut(); navigate('/'); }} className="btn-ghost !min-h-0 !px-2.5 !py-2" aria-label="Sign out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-dark !min-h-0 !px-4 !py-2">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
