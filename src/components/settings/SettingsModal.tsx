import { useEffect, useState } from 'react';
import { CalendarClock, Construction, KeyRound, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/lib/context/AuthContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useToast } from '@/lib/context/ToastContext';
import { changeMyPassword, getMaintenanceMode, getStudentCodeYear, rollStudentCodeYear, setMaintenanceMode } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils/errors';

/** Admin dashboard settings: theme, maintenance mode, the yearly roll of student refs and badge IDs, and an admin's own password. */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  // The developer is not an admin here: only an admin changes a password from Settings.
  const isPlainAdmin = user?.role === 'admin';
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // The confirm dialog is a modal too; this one steps aside while it is up.
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!open) return;
    getMaintenanceMode().then(setMaintenance).catch(() => setMaintenance(false));
    getStudentCodeYear().then(setYear).catch((err) => showToast(errorMessage(err, 'Could not load the student ref year'), 'error'));
  }, [open, showToast]);

  const toggleMaintenance = async () => {
    setBusy(true);
    try {
      const next = await setMaintenanceMode(!maintenance);
      setMaintenance(next);
      showToast(next ? 'Maintenance on' : 'Maintenance off');
    } catch (err) {
      showToast(errorMessage(err, 'Could not update maintenance mode'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const roll = async () => {
    if (year === null) return;
    setRolling(true);
    const accepted = await confirm({
      title: `Roll to ${year + 1}?`,
      message: (
        <>
          <span className="block">Student refs {year} → {year + 1}</span>
          <span className="block">Count restarts at 001</span>
          <span className="block">Badge IDs follow the ref year</span>
          <span className="block">Existing refs and IDs stay</span>
          <span className="block">Cannot be undone</span>
        </>
      ),
      confirmLabel: 'Roll year',
      danger: true,
      requireText: 'Confirm',
    });
    if (accepted) {
      setBusy(true);
      try {
        const next = await rollStudentCodeYear();
        setYear(next);
        showToast(`Rolled to ${next}`);
      } catch (err) {
        showToast(errorMessage(err, 'Could not roll the year'), 'error');
      } finally {
        setBusy(false);
      }
    }
    setRolling(false);
  };

  const closePassword = () => {
    if (busy) return;
    setChanging(false);
    setPassword('');
    setAgain('');
  };

  const savePassword = async () => {
    setBusy(true);
    try {
      await changeMyPassword(password);
      showToast('Password changed');
      setChanging(false);
      setPassword('');
      setAgain('');
    } catch (err) {
      showToast(errorMessage(err, 'Could not change the password'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const mismatch = again.length > 0 && again !== password;

  return (
    <>
    <Modal open={open && !rolling && !changing} onClose={onClose} title="Settings" size="sm">
      <div className="settings-list">
        <div className="settings-row">
          <span className="settings-row-label">{theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />} Dark mode</span>
          <Switch checked={theme === 'dark'} onChange={toggle} label="Dark mode" />
        </div>
        <div className="settings-row">
          <span className="settings-row-label"><Construction size={17} /> Maintenance</span>
          <Switch checked={Boolean(maintenance)} onChange={() => void toggleMaintenance()} label="Maintenance mode" danger disabled={busy || maintenance === null} />
        </div>
        <div className="settings-row">
          <span className="settings-row-label"><CalendarClock size={17} /> Student ref year</span>
          <div className="settings-row-end">
            <strong className="settings-year">{year ?? '—'}</strong>
            <Button className="settings-roll" variant="secondary" size="sm" onClick={() => void roll()} disabled={busy || year === null}>
              Roll
            </Button>
          </div>
        </div>
        {isPlainAdmin && (
          <div className="settings-row">
            <span className="settings-row-label"><KeyRound size={17} /> Password</span>
            <Button className="settings-roll" variant="secondary" size="sm" onClick={() => setChanging(true)}>
              Change
            </Button>
          </div>
        )}
      </div>
    </Modal>

    <Modal
      open={open && changing}
      onClose={closePassword}
      title="Change password"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={closePassword} disabled={busy}>Cancel</Button>
          <Button className="action-button-compact" onClick={() => void savePassword()} loading={busy} disabled={password.length < 8 || again !== password}>
            Change
          </Button>
        </>
      }
    >
      <div className="popup-form-spaced">
        <FormField label="New password" required>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm password" required>
          <input type="password" value={again} onChange={(event) => setAgain(event.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
          {mismatch && <p className="field-flag">Does not match</p>}
        </FormField>
      </div>
    </Modal>
    </>
  );
}
