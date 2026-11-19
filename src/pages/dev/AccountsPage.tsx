import { useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { listAdminAccounts, createAdminAccount, deleteAdminAccount, resetAdminPassword, type AdminAccount } from '@/lib/supabase';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const EMPTY = { full_name: '', email: '', password: '' };

// Developer only. Admin accounts made here sign in at the admin door.
export default function AccountsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<AdminAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    setAdmins(await listAdminAccounts());
  });

  const close = () => {
    if (saving) return;
    setOpen(false);
    setForm(EMPTY);
  };

  const save = async () => {
    setSaving(true);
    try {
      await createAdminAccount(form);
      setAdmins(await listAdminAccounts());
      setOpen(false);
      setForm(EMPTY);
      showToast('Admin account created');
    } catch (err) {
      showToast(errorMessage(err, 'Could not create the account'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const closeReset = () => {
    if (saving) return;
    setResetting(null);
    setNewPassword('');
  };

  const reset = async () => {
    if (!resetting) return;
    setSaving(true);
    try {
      await resetAdminPassword(resetting.id, newPassword);
      showToast('Password reset');
      setResetting(null);
      setNewPassword('');
    } catch (err) {
      showToast(errorMessage(err, 'Could not reset the password'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (admin: AdminAccount) => {
    const accepted = await confirm({
      title: `Delete ${admin.name || admin.email}?`,
      message: (
        <>
          <span className="block">Login deleted, cannot sign in</span>
          <span className="block">Their log entries stay</span>
          <span className="block">Cannot be undone</span>
        </>
      ),
      confirmLabel: 'Delete login',
      danger: true,
      requireCheck: 'Yes, delete this login',
    });
    if (!accepted) return;
    try {
      await deleteAdminAccount(admin.id);
      setAdmins((current) => current.filter((entry) => entry.id !== admin.id));
      showToast('Login deleted');
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete the login'), 'error');
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader
        title="Accounts"
        action={<Button className="action-button-compact" onClick={() => setOpen(true)}><Plus size={16} />Add admin</Button>}
      />

      {admins.length === 0 ? (
        <EmptyState icon={<KeyRound size={32} />} title="No admin accounts" />
      ) : (
        <Table maxHeight="none">
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Created</TH>
              <TH>Last sign-in</TH>
              <TH align="center"><span className="sr-only">Actions</span></TH>
            </TR>
          </THead>
          <TBody>
            {admins.map((admin) => (
              <TR key={admin.id}>
                <TD className="font-semibold text-[var(--text-primary)]">{admin.name || '—'}</TD>
                <TD className="cell-secondary">{admin.email}</TD>
                <TD className="cell-muted">{formatDate(admin.created_at)}</TD>
                <TD className="cell-muted">{admin.last_sign_in_at ? formatDate(admin.last_sign_in_at) : '—'}</TD>
                <TD align="center">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="sm" variant="ghost" className="action-button-compact" onClick={() => setResetting(admin)}>
                      <KeyRound size={14} /> Reset
                    </Button>
                    <Button size="sm" variant="ghost" className="action-button-icon action-button-danger" onClick={() => void remove(admin)} aria-label={`Delete ${admin.email}`} title="Delete login">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={open}
        onClose={close}
        title="Add admin"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
            <Button
              className="action-button-compact"
              onClick={() => void save()}
              loading={saving}
              disabled={!form.full_name.trim() || !form.email.includes('@') || form.password.length < 8}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="popup-form-spaced">
          <FormField label="Name" required>
            <input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          </FormField>
          <FormField label="Email" required>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="off" />
          </FormField>
          <FormField label="Password" required>
            <PasswordInput value={form.password} onChange={(password) => setForm({ ...form, password })} />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={resetting !== null}
        onClose={closeReset}
        title={`Reset password for ${resetting?.name || resetting?.email || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={closeReset} disabled={saving}>Cancel</Button>
            <Button className="action-button-compact" onClick={() => void reset()} loading={saving} disabled={newPassword.length < 8}>
              Reset
            </Button>
          </>
        }
      >
        <FormField label="New password" required>
          <PasswordInput value={newPassword} onChange={setNewPassword} />
        </FormField>
      </Modal>
    </div>
  );
}
