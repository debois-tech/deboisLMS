import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, UserRound } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';
import { AuthSurface } from './LoginPage';

export default function LoginChoicePage() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <AuthSurface>
      <div className="auth-panel auth-choice-panel">
        <div className="auth-brand-mark">
          <img src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="Deboistech" />
        </div>
        <h1 className="auth-title">Log in</h1>

        <div className="auth-choice-list">
          <button type="button" className="auth-choice" onClick={() => navigate('/auth/login/admin')}>
            <span className="auth-choice-icon"><ShieldCheck size={21} /></span>
            <span className="auth-choice-copy"><strong>Admin</strong><small>Dashboard</small></span>
            <ArrowRight className="auth-choice-arrow" size={18} />
          </button>
          <button type="button" className="auth-choice" onClick={() => navigate('/auth/login/user')}>
            <span className="auth-choice-icon"><UserRound size={21} /></span>
            <span className="auth-choice-copy"><strong>User</strong><small>Coming soon</small></span>
            <ArrowRight className="auth-choice-arrow" size={18} />
          </button>
        </div>

      </div>
    </AuthSurface>
  );
}
