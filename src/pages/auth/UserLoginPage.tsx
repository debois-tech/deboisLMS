import { LoginPanel } from './LoginPage';

export default function UserLoginPage() {
  return (
    <LoginPanel
      title="Student login"
      emailPlaceholder="you@email.com"
      hint="Use the email and password shared by your coordinator."
    />
  );
}
