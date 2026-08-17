import { LoginPanel } from './LoginPage';

export default function UserLoginPage() {
  return (
    <LoginPanel
      title="Student login"
      emailPlaceholder="you@email.com"
      expectedRole="student"
      hint="Use the credentials from your coordinator."
    />
  );
}
