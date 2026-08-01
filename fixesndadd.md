# Fixes & Additions — UI, Features

## UI Bug Fixes

### Batches page — "Add Students" button (inside a batch)
- Reduce horizontal space a little — button is too wide.
- On the popup that opens on click:
  - Add space between fields, texts, and buttons.
  - The "select student" field is too close to the "total fees per student" text — add spacing.
  - Same spacing issue between the field and the "add selected" button.
  - Reduce the horizontal padding of the "add selected" button.

### Remove asterisk and number-input spinners
- Remove the `*` asterisk from the text "total fees per student *" — present in **2 popups**: the "add single student" one and the "add using CSV" one.
- Remove the up/down key (spinner) inside the amount field used to change the number — remove it from **all places** used to update a numeric amount.

### Same button-and-field spacing issue (recurring pattern)
- **Tutor section** inside batch details — the "assign tutor" popup.
- **"Add lecture"** popup.
- **"Add log"** popup for finance.

### Student details page — spacing
- Add spacing between the title and the display data in cards like "current batch" and "next lecture".
- **Total payment card:**
  - First, move the "Rs X due" to the far right side of the card.
  - Then add spacing between the title and the "Rs X / Rs Y" section that shows how much is paid out of total.
  - Keep the due amount and the comparison section in the same row.

### Reusable popup widget
- The popups that need UI fixes above exist in multiple places (e.g. the "add log" finance popup exists both in **batches** and in the **finance** section).
- First create a **custom reusable widget** of it, update the UI, and reuse it wherever needed.

## Feature Update

### Attendance — merge the two buttons into one
- Currently there are 2 buttons in the attendance section:
  1. "Upload to database"
  2. "Convert and show"
- They do different jobs. Replace with **a single button** that does the entire thing:
  1. Upload to DB (upload table).
  2. Process / add new data to the attendance table and show the output.
  3. Clear the upload table for the next input.
- (These jobs are currently distributed between the two buttons.)

### Global success/error messages
- Success/error messages across the entire website should become **small popup messages** that:
  - Appear at the middle-bottom of the screen or at the left/right corner of the screen.
  - Show the message, then go away on their own (auto-dismiss).
- **Create a custom element** for this.

### Finance colors on homepage
- In the finance section, colors are used to code **collected** and **due** money in the stats cards.
- Apply the **same** color coding on the homepage.

## Feature Add

### Student name link inside batches details table
- In finance we added a text button for all student names that redirects to the student details page.
- Add the **exact same** thing inside the table in the **batches details** section.
- (First make reusable widgets for anything that is used in multiple places.)

## Note
- Wherever reusable widgets were asked for above — **if they are already created, ignore that request.**
