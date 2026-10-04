import { useEffect, useState } from 'react';
import { CalendarClock, Construction, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useToast } from '@/lib/context/ToastContext';
import { getMaintenanceMode, getStudentCodeYear, rollStudentCodeYear, setMaintenanceMode } from '@/lib/supabase';
import { errorMessage } from '@/lib/utils/errors';

function Switch({ checked, onChange, label, danger, disabled }: {
  checked: boolean;
  onChange: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`settings-switch${danger ? ' is-danger' : ''}`}
    />
  );
}

/** Admin dashboard settings: theme, maintenance mode, and the yearly roll of student refs and badge IDs. */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, toggle } = useTheme();
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

  return (
    <Modal open={open && !rolling} onClose={onClose} title="Settings" size="sm">
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
      </div>
    </Modal>
  );
}
