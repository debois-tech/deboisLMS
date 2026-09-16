import { LoginPanel } from './LoginPage';

export default function TutorLoginPage() {
  return (
    <LoginPanel
      title="Tutor login"
      emailPlaceholder="you@deboistech.in"
      expectedRole="tutor"
      hint="Use the credentials from your admin."
    />
  );
}
