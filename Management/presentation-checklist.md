# Presentation Preparation Checklist

Last updated: 2026-07-12

---

## 1. Technical Environment (blocking everything else)

- [x] **Supabase restore** — project was paused, go to app.supabase.com → SeekSuit → "Restore project"
- [x] **dev.ps1 + Docker** — verify all containers start correctly
- [ ] **AI service warm-up** — BiRefNet loads slowly, don't wait on this during the presentation
- [ ] **Cold start** — boot everything ~10 minutes before supervisors arrive

---

## 2. Demo Materials

- [ ] Random real image that works with image search (prepare and test in advance)
- [ ] Vest + suit with processed images ready for upload demo
- [ ] before/after fine-tuning images — bow tie + pants (improvement evidence)
- [x] **Verify DB has good products** — 309 processed images, DB clean, storage buckets audited (87 orphans deleted from processed-images)

---

## 3. System Walkthrough — feature by feature

- [ ] Dashboard — cards, leading product scoring
- [ ] Gallery, mannequin screen, text+image screen
- [x] **Chat AI — URGENT:** test that new query creation actually works (never tested — this is a risk)
- [ ] Prepare answer about AI: how it works, it's currently free, owner can upgrade, we kept costs low
- [ ] Fine-tuning story: bow tie + pants improved; shirts + suits didn't work → solved differently

---

## 4. Architecture

- [ ] Know the component diagram well
- [ ] Know communication between components
- [ ] Know what is stored in DB and why
- [ ] Know the pipeline + models per feature: BiRefNet, CLIP, YOLOS, Claude/GPT...

---

## 5. Jira

- [ ] Change all task descriptions format to: `As a user, I want... so that...`
- [ ] Prepare ~5 specific user stories that are comfortable to discuss

---

## 6. Code

- [ ] Identify impressive/significant code sections
- [ ] Be able to explain them from first principles

---

## 7. Video Presentation (optional)

- [ ] Broad problem framing before playing the video
- [ ] Sharpen: what is the problem + how our solution solves it

---

## 8. Additional (not in original list)

- [ ] **KAN-162 hybrid search** — Daniel closed the ticket, but is it actually merged and working?
- [ ] **VTO / RunPod** — verify the image is still live and functional
- [ ] **Internet at presentation venue** — CLIP + RunPod require connection
- [ ] **Browser ready in advance** — tabs open, logged in as admin
- [ ] **Backup plan** — if image search fails live, have screenshot/video ready

---

## Priority Order

1. Supabase restore (blocks everything)
2. Chat AI testing (never tested — risk)
3. Jira format (clear, fast work)
4. Demo materials
5. Architecture + code walkthrough
