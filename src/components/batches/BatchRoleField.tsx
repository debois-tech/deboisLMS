import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { addInternshipRole } from '@/lib/supabase';
import { cleanRole, normalizeRole } from '@/lib/utils/studentImport';

/** Sentinel for the "not in the list yet" row, which reveals the name box. */
const NEW_ROLE = '__new__';

/** `pick` is an existing role, NEW_ROLE or ''. `name` is what was typed under NEW_ROLE. */
export interface RoleDraft {
  pick: string;
  name: string;
}

export const roleReady = (draft: RoleDraft) =>
  draft.pick !== '' && (draft.pick !== NEW_ROLE || cleanRole(draft.name) !== '');

/** The batch's internship role: pick one, or add one. Shared by New Batch and Edit Batch. */
export function BatchRoleField({ roles, draft, onChange }: {
  roles: string[];
  draft: RoleDraft;
  onChange: (draft: RoleDraft) => void;
}) {
  return (
    <>
      <FormField label="Internship Role" required>
        <SearchSelect
          showSearch={false}
          options={[...roles.map((option) => ({ value: option, label: option })), { value: NEW_ROLE, label: 'Add a new role' }]}
          value={draft.pick || null}
          onChange={(pick) => onChange({ ...draft, pick })}
          placeholder="Select a role"
          searchPlaceholder="Search"
          emptyText="No match"
        />
      </FormField>
      {draft.pick === NEW_ROLE && (
        <FormField label="Role Name" required>
          <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} maxLength={60} required />
        </FormField>
      )}
    </>
  );
}

/** The role to store. A typed name matching an existing one joins it; any other becomes a new role. */
export async function saveRole(draft: RoleDraft, roles: string[]): Promise<string> {
  if (draft.pick !== NEW_ROLE) return draft.pick;
  const typed = cleanRole(draft.name);
  return roles.find((role) => normalizeRole(role) === normalizeRole(typed)) ?? addInternshipRole(typed);
}
