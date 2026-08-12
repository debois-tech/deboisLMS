# Pending work

Email is **out of scope** — dropped 12 Aug 2026. Everything that depended on it is
parked below rather than deleted, so it can be picked up if that changes.

Security work is finished and archived in `completed md/SECURITY.md`; only item 4 there
(browser security headers) is open, deliberately last, at deployment.

---

## Done: instalment reminder in the portal

The portal half of the reminder shipped without any email or schedule table.

The schedule is **derived, not stored**: instalments fall 20 and 40 days after the
batch's `start_date`, two at most. Nothing to enter, nothing to keep in sync.

- `src/lib/utils/installments.ts` — the whole rule. `dueInstallment()` returns a value
  only inside the 3-day window before a date, or once it is missed; the status card
  falls back to class/assignment/balance the rest of the time.
- An instalment counts as paid once a payment is logged against that batch. The
  registration fee is excluded by note, so it never settles instalment 1 by itself.
- `PortalFocus` gained a `tone` prop rather than a second component; `attention` is what
  a missed instalment uses.

**Known limits**, both fine for two instalments and worth knowing:

- A batch with no `start_date` never shows a reminder — there is nothing to count from.
- Paying both instalments early settles the schedule early, because the rule counts
  payments rather than matching them to dates.

---

## Parked: anything needing email

Both need a transactional sender (Supabase's mailer only sends auth templates), a
verified `deboistech.in` domain with SPF and DKIM, and an API key in Supabase secrets.
DNS is the long pole, not the code.

- **Send login credentials.** Admin clicks a button, student gets their portal email and
  password. The password is derived, so it can be recomputed at send time — no schema
  change. Worth pairing with a real password reset first: emailing a permanent credential
  into an inbox is what turns the accepted risk in the security doc into a live one.
- **Instalment reminder emails.** The portal already says it; email would repeat it on a
  schedule. Needs `pg_cron` plus a `reminded_at` marker, or the same student is mailed
  every day until they pay.

---

## Student code: resetting it, and testing after launch

**Your assumption is right.** `student_code` comes from `next_student_code()`, which
calls `nextval('student_code_seq')`. A sequence never goes backwards and never reuses a
number — deleting a student frees nothing. That is deliberate: a code that could be
handed to a second person is not an ID.

So test students you delete still burn codes, which is why you are at 32/33.

### Reset the counter before go-live

Two statements, in this order. The guard in `set_student_code_year()` refuses to restart
while codes exist under the current prefix, so the rows go first:

```sql
-- 1. Clear the test data. Cascades to enrolments, fees, attendance, submissions.
delete from students;

-- 2. Restart the counter. Returns the prefix it will now issue under.
select set_student_code_year(2026);
```

`delete from students` does **not** remove their Supabase Auth users — those are in
`auth.users` and only linked by `auth_user_id`. Orphaned logins can still sign in and
will fail on a missing student record. Clear them in Dashboard → Authentication → Users,
or:

```sql
delete from auth.users
where id not in (select auth_user_id from students where auth_user_id is not null)
  and (raw_app_meta_data ->> 'role') = 'student';
```

If you only want to restart the counter without deleting anyone — say codes 1–5 are real
and 6–33 were tests — do not use the function. Delete the test rows, then set the
sequence by hand:

```sql
select setval('student_code_seq', 5);   -- next issued is 006
```

### Testing after launch without touching live data

This is the more important half, and it is worth setting up before you deploy rather
than after.

**A second Supabase project is the only clean answer.** Same schema, throwaway data, its
own URL and anon key. Nothing you do there can reach production.

1. Create a second project, e.g. `deboistech_lms_dev`.
2. Run `supabase/schema.sql` on it — it builds everything from nothing, which is exactly
   what the consolidation was for.
3. Tag an admin in it: edit the email in the `update auth.users` block near the top of
   `schema.sql` before running, or run that statement separately afterwards.
4. Keep a `.env.development` pointing at it. Vite loads that for `npm run dev`
   automatically, so local work hits the test project and the deployed build keeps using
   the production values from Vercel's env settings:
   ```
   VITE_SUPABASE_URL=https://<dev-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<dev anon key>
   ```
   `.gitignore` already covers `.env*`.
5. Edge functions deploy per project, so deploy them to the dev ref too, with their own
   secrets (`SECRET_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS`).

The free tier allows two projects, and inactive ones pause after a week — a paused
project wakes on the next request, which is fine for occasional testing.

**What this costs:** schema changes have to be applied twice, and it is easy to test
against dev and forget to migrate production. Whatever the next migration is, run it on
dev first, then production, and note in the migration header that it has been applied to
both.

**The weaker alternative**, if a second project is not on: keep using one database and
mark test records so they can be found and removed — a `Z-TEST` prefix in the name, all
under one throwaway batch you can delete afterwards. It works, but nothing stops a test
from touching a real student's row, and the code counter still burns numbers.

---

## Suggested order

1. **Reset the student code counter** before go-live, per the section above.
2. **Set up the second Supabase project** so post-launch testing has somewhere to go.
3. **Browser security headers** at deployment — see `completed md/SECURITY.md` item 4.
4. Email work only if it comes back into scope, starting with DNS.
