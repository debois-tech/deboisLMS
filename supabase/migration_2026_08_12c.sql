-- =============================================================================
-- Migration — 12 Aug 2026 (c)
-- =============================================================================
-- Run after migration_2026_08_12b.sql. Non-destructive.
--
--   1. Every batch must name a programme
--
-- Refuses rather than guesses: if any batch has no programme it names them and
-- changes nothing, so re-run once they are set.
-- =============================================================================

-- A null programme is invisible to the CSV importer — resolveProgramBatch() only
-- matches batches whose programme equals the code being imported, so the batch
-- silently never appears. The forms already require one; this closes the column.
do $$
declare missing int;
begin
  select count(*) into missing from batches where program is null;
  if missing > 0 then
    raise exception
      'Set a programme on % batch(es) first — run: select id, name from batches where program is null;',
      missing;
  end if;
end $$;

alter table batches alter column program set not null;
