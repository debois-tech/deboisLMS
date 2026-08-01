import { ArrowLeft, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/lib/context/ThemeContext';
import { AuthSurface } from './LoginPage';

export default function UserLoginPlaceholderPage() {
  const { theme } = useTheme();

  return (
    <AuthSurface>
      <div className="auth-panel auth-placeholder-panel">
        <Link to="/auth/login" className="auth-back-link">
          <ArrowLeft size={15} />
          Back
        </Link>
        <div className="auth-brand-mark">
          <img src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="Deboistech" />
        </div>
        <div className="auth-placeholder-icon"><UserRound size={23} /></div>
        <h1 className="auth-title">User login</h1>
        <div className="auth-soon">Coming soon</div>
      </div>
    </AuthSurface>
  );
}
