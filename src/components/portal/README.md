# Student portal widget kit

Everything a portal page is made of lives here. Pages import from the barrel
(`@/components/portal`) and compose these widgets — they do not write their own
headings, cards, rows, pills or empty states. That is what keeps four pages, and
the fifth one you are about to add, looking like one product.

## Adding a portal page

1. Add the route under `/portal` in `src/App.tsx`.
2. Add an entry to `portalNavItems` in `src/components/layout/PortalNav.tsx`. That
   file is the drawer behind the topbar's hamburger — the portal has no other
   chrome, so a section not listed there is unreachable.
3. Write the page:

```tsx
import { CalendarCheck } from 'lucide-react';
import {
  PortalEmpty, PortalList, PortalPage, PortalRow,
  PortalSection, PortalStat, PortalStatGrid, PortalStatus, usePortalStudentId,
} from '@/components/portal';

export default function PortalThingPage() {
  const studentId = usePortalStudentId();

  // Never fetch in a bare effect: every query throws, and a page that only tracks
  // `loading` shows its skeleton forever when the read is refused.
  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    setThings(await getThingsForStudent(studentId));
  });

  return (
    <PortalPage title="Your things" loading={loading} error={error} onRetry={retry}>
      {things.length === 0 ? (
        <PortalEmpty icon={CalendarCheck}>Nothing here yet.</PortalEmpty>
      ) : (
        <>
          <PortalStatGrid>
            <PortalStat label="Done" icon={CalendarCheck} value="8 of 10" note="Two still to go" />
          </PortalStatGrid>

          <PortalSection title="One by one">
            <PortalList>
              {things.map((thing) => (
                <PortalRow
                  key={thing.id}
                  primary={thing.name}
                  secondary="One quiet line of context"
                  trailing={<PortalStatus kind="attendance" value={thing.status} />}
                />
              ))}
            </PortalList>
          </PortalSection>
        </>
      )}
    </PortalPage>
  );
}
```

## The widgets

| Widget | Use it for |
|---|---|
| `PortalPage` | The page frame: the one h1, an optional page-wide control, the loading skeleton and the failed-load state. Pass `shape="list"` on a page with no stat tiles so the placeholder matches what loads, and always pass `error`/`onRetry` from `useInitialLoad`. |
| `PortalFocus` | The answer to "what do I do now?". **At most one per page** — a second one means neither is the focus. Only the Home page has one today. |
| `PortalStatGrid` + `PortalStat` | Numbers with the sentence that explains them. `progress` draws the bar; `tone` colours the value from semantic tokens. |
| `PortalSection` | A labelled group. Its label deliberately sits *below* the page title in weight so pages never stack competing headings. |
| `PortalIdentity` | Who the student is, as the masthead of a page about them. Monogram, name, ID chip, contact, external links. A rule under it, never a card — the labelled cards below are details of this person, not siblings of it. One per page, and only the profile has one. |
| `PortalList` + `PortalRow` | Any list of records. `onClick` makes a row a real button with a chevron; `state` adds the amber/green dot; `muted` dims rows that need no attention. `head` puts the figure the rows add up to inside the same card, so a total and its breakdown stay one object. |
| `PortalAmount` | One sum of money, given the weight of the answer it is. Goes in a `PortalList`'s `head`. Pass an already-formatted value and a `tone`; never colour it in the page. |
| `PortalFacts` | Read-only facts about the student — a college, a date of birth. Not a list of records: nothing here opens. Blank values are dropped, so check the array is non-empty before rendering it or you get a labelled section with nothing under it. |
| `PortalStatus` | Every status pill. Pass the domain value (`present`, `due`, `active`…), never a label or a colour. |
| `PortalEmpty` | Any empty list. |
| `MaterialViewer` | Read-only PDF reader for study material. Full-screen, canvas-rendered, watermarked server-side. Also used by the admin material page for previews. |

## Rules that keep it consistent

- **No colour literals in a page.** No `text-amber-400`, no `text-emerald-400`. A
  value that means something uses `PortalStat`'s `tone`; a state uses
  `PortalStatus`. Both resolve to `--success` / `--warning` in one place.
- **No raw enum reaches the screen.** The schema says `partial` and `dropped`; a
  student reads "Partly attended" and "Finished". `PortalStatus.tsx` holds the
  entire translation — extend that map, never the page.
- **Phrases, not sentences.** The portal is scanned, not read. "11 of 12 classes",
  not "You were in 11 of 12 classes so far". Empty states are a phrase and a full
  stop — *"No attendance marked yet."* — never an explanation of who will fill
  them. Drop a `note` or a `detail` entirely when the value above it already says
  everything; blank is better than a line that restates.
- **One h1 per page, and it is plain.** "Your attendance", not "Attendance".
  Nothing goes directly under it — supporting facts belong in the content.
- **Write for someone who has never used it.** No internal vocabulary
  (*approved*, *mapping*, *outstanding*), no counts without their unit.
- **An empty state means "no rows", never "the read failed".** A page that hides a
  refused query behind *"No classes yet."* tells a student their record is gone.
  `useInitialLoad` separates the two; `PortalPage`'s `error` renders the second.
  The thrown message never reaches the student — they cannot act on `PGRST301`.
