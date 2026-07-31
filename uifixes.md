# UI Fixes & Feature Requests

## Batch Details Page

**Students section — modal placement bug:**
- The "Add Student" button (single student add) works functionally, but when students already exist in the list, the add-student pop-up card gets pushed down and flows below the visible screen. Fix the modal positioning so it stays centered/visible regardless of list length.

**Finance section:**
- Remove the "Update Total" button entirely.
- Fix the payment-log pop-up card — it has the same placement issue as the student modal (flows below the screen).
- Also fix the card's internal formatting: text and input boxes are cramped / too close together and the layout looks broken.

## Student Details Page

**Add 2 new cards/sections:**

1. **Overview card (top):** Show current batch, total payment, and next upcoming lecture. Match the lecture against `now()` to pick the upcoming one; if none exists, display **"Caught up with all lectures"**.

2. **Payment logs card (bottom):** Display the fee/payment logs for this student.

## Finance Table — Navigation

- In the finance table (the same table component reused on both the batches page and elsewhere), clicking a student's name should navigate to that student's details page, where the payment logs are shown.
