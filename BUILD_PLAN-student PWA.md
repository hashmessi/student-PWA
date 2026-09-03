# BUILD PLAN — Student Face Dataset Collection PWA
### For Smart Attendance System (Face Recognition Module)

---

## 1. Objective

Build a lightweight, installable **Progressive Web App (PWA)** that:
- Collects student identity details.
- Captures **4 clean, validated face images** per student (Front, Left, Right, Overall/Neutral).
- Exports the dataset in a **clean, per-student, non-mixed structure** ready to feed directly into a face-recognition training/embedding pipeline.

**Non-goals (out of scope for this app):**
- Actual face recognition/matching (this app only *collects* data).
- Attendance marking logic.
- Admin analytics dashboard (can be a later phase).

---

## 2. Student Data Schema

Each student record captured via a form:

| Field       | Key         | Type    | Validation Rule                              |
|-------------|-------------|---------|-----------------------------------------------|
| Name        | `name`      | string  | Required, letters/spaces only                 |
| Reg. No     | `regNo`     | string  | Required, unique, alphanumeric (institution format) |
| Department  | `dept`      | enum    | Fixed to `IT` (extendable dropdown for future) |
| Section     | `section`   | enum    | e.g. A / B / C — dropdown                      |
| College Email | `email`   | string  | Must match institution domain regex e.g. `^[a-zA-Z0-9._%+-]+@college\.edu$` |

> **Uniqueness rule:** `regNo` is the **primary key**. If a `regNo` already has a completed dataset locally, the app blocks re-registration unless in "Update/Recapture" mode — this is the #1 defense against mixed/duplicate datasets.

---

## 3. Face Capture Specification

4 mandatory shots per student, captured in a **fixed guided sequence** (prevents user from skipping/mixing angles):

| Step | Pose        | Guide Instruction                          | Auto-Check                          |
|------|-------------|---------------------------------------------|---------------------------------------|
| 1    | Front       | Look straight at camera, neutral expression | Face detected, centered, both eyes visible |
| 2    | Left        | Turn head ~45° to the left                  | Face detected, yaw angle in left range |
| 3    | Right       | Turn head ~45° to the right                 | Face detected, yaw angle in right range |
| 4    | Overall/Clear | Straight-on, good lighting, final clear capture | Face detected, sharpness/brightness above threshold |

### Quality Gate (must pass before accepting any shot)
Use an in-browser face-detection model (see Tech Stack) to auto-reject bad captures:
- ✅ Exactly **1 face** detected (reject 0 or >1 faces — prevents bystanders in frame).
- ✅ Face bounding box occupies a minimum % of frame (prevents too-far/tiny faces).
- ✅ Blur/sharpness score above threshold (Laplacian variance check).
- ✅ Brightness within acceptable range (reject too dark/overexposed).
- ✅ Approximate head-pose/yaw check per step (front ≈0°, left/right within expected range).

If a check fails → show live feedback ("Move closer", "Face not centered", "Too dark") and **do not allow proceeding** until corrected.

### Image Standards
- Resolution: capture at device max, **downscale + compress to a fixed standard** on save (e.g. 720×720, JPEG quality 85%) — keeps dataset uniform and export size small.
- Format: `.jpg`
- Color: RGB, no filters/beautification.

---

## 4. Application Architecture (PWA)

```
┌─────────────────────────────────────────────┐
│                  PWA Shell                    │
│  (manifest.json + service worker + offline)   │
├─────────────────────────────────────────────┤
│  Screen 1: Student Registration Form          │
│  Screen 2: Guided Camera Capture (4 steps)    │
│  Screen 3: Review & Confirm (retake option)   │
│  Screen 4: Local Save + Sync/Export            │
├─────────────────────────────────────────────┤
│   Local Storage Layer (IndexedDB)             │
│   - studentMeta store                          │
│   - photoBlobs store                           │
├─────────────────────────────────────────────┤
│   Face Detection Engine (in-browser, WASM)    │
├─────────────────────────────────────────────┤
│   Export Engine → ZIP builder → CSV/JSON index│
└─────────────────────────────────────────────┘
```

**Why offline-first / IndexedDB:** College labs/campuses may have patchy connectivity. Capture must work fully offline; sync/export happens whenever convenient (or export stays fully local/manual — no server needed at all for MVP).

---

## 5. Recommended Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React (Vite) or plain HTML/JS | Fast, small PWA footprint |
| PWA tooling | `vite-plugin-pwa` / Workbox | Service worker + manifest out of the box |
| Camera access | `MediaDevices.getUserMedia` | Native browser camera API |
| Face detection (client-side) | `face-api.js` (TinyFaceDetector) or `MediaPipe FaceMesh` (via WASM) | Runs fully in-browser, no server, gives face count + bounding box + landmarks (for yaw estimation) |
| Local storage | IndexedDB (via `idb` library) | Structured, handles blobs well, offline-capable |
| Image processing | Canvas API | Resize/compress before saving |
| Export/Zip | `JSZip` | Build clean per-student zip / full-batch zip client-side |
| CSV/JSON index | Native JS (`Blob` + manual CSV builder) | No dependency needed |
| Hosting | Any static host (Netlify/Vercel/Institution server) | PWA is static-servable |

*(No backend is strictly required for MVP — everything runs client-side and exports as files. A backend can be added later for centralized sync across multiple capture devices.)*

---

## 6. Export Design — Clean, Non-Mixed Dataset

This is the most critical part per your requirement. Structure:

### 6.1 Folder-per-student (inside export ZIP)
```
dataset_export_<timestamp>/
│
├── index.csv                     ← master index, one row per student
├── index.json                    ← same data, JSON form (for pipeline scripts)
│
└── students/
    ├── 21IT001_JohnDoe/
    │   ├── metadata.json
    │   ├── front.jpg
    │   ├── left.jpg
    │   ├── right.jpg
    │   └── overall.jpg
    │
    ├── 21IT002_JaneSmith/
    │   ├── metadata.json
    │   ├── front.jpg
    │   ├── left.jpg
    │   ├── right.jpg
    │   └── overall.jpg
    │
    └── ...
```

**Naming convention:** `<RegNo>_<Name-no-spaces>/` — RegNo first guarantees sort order and guarantees uniqueness (no two students can collide even if names match).

### 6.2 `metadata.json` (per student)
```json
{
  "regNo": "21IT001",
  "name": "John Doe",
  "dept": "IT",
  "section": "A",
  "email": "john.doe@college.edu",
  "capturedAt": "2026-09-03T10:15:00Z",
  "images": {
    "front": "front.jpg",
    "left": "left.jpg",
    "right": "right.jpg",
    "overall": "overall.jpg"
  },
  "qualityChecksPassed": true
}
```

### 6.3 `index.csv` (master index — one row per student, easy to open in Excel/pandas)
```csv
regNo,name,dept,section,email,front,left,right,overall,capturedAt
21IT001,John Doe,IT,A,john.doe@college.edu,students/21IT001_JohnDoe/front.jpg,...,2026-09-03T10:15:00Z
```

### Why this prevents "mixing":
- Every image lives **only** inside its own student's folder — never a shared/global image pool.
- `regNo` is embedded in the folder name **and** the metadata **and** the CSV row → triple-verifiable, easy to script a sanity-check that folder count == 4 images == metadata match.
- A pre-export validation pass rejects export if any student has <4 valid images or a mismatched regNo/folder pairing.

### 6.4 Export options to build
1. **Full batch export** — one ZIP with all students (for bulk upload to training pipeline).
2. **Single student export** — for re-capture/correction workflows.
3. Optional: **direct download to device Downloads folder** vs. **push to Google Drive/institution server** (future enhancement).

---

## 7. User Flow

```
Start
  │
  ▼
[Enter Student Details Form] → validate fields → check regNo not already completed
  │
  ▼
[Guided Capture: Front] → quality gate → pass → next
  │
  ▼
[Guided Capture: Left] → quality gate → pass → next
  │
  ▼
[Guided Capture: Right] → quality gate → pass → next
  │
  ▼
[Guided Capture: Overall/Clear] → quality gate → pass → next
  │
  ▼
[Review Screen] → thumbnails of all 4 + option to retake any single shot
  │
  ▼
[Confirm & Save] → store in IndexedDB as complete record
  │
  ▼
[Repeat for next student]  ──or──  [Export Dataset (ZIP + CSV + JSON)]
```

---

## 8. Data Privacy & Consent (institutional requirement)

- Show a **consent notice** before first capture: data used only for attendance system, stored securely, deletion policy.
- Do not upload raw images to any third-party service — all detection runs client-side.
- Provide an **admin-only delete** function per student record (for opt-outs / re-capture requests).
- Recommend storing exported ZIPs on institution-controlled storage only, not public cloud.

---

## 9. Development Phases

| Phase | Deliverable | Est. Effort |
|-------|-------------|--------------|
| 1. Setup | PWA shell, manifest, service worker, routing | 1–2 days |
| 2. Form | Student registration form + validation + regNo uniqueness check (IndexedDB) | 1 day |
| 3. Camera + Detection | Camera stream, face-api.js integration, live quality gate overlays | 3–4 days |
| 4. Guided Capture Flow | 4-step sequence, retake logic, review screen | 2 days |
| 5. Local Storage | IndexedDB schema (studentMeta + photoBlobs), CRUD | 1–2 days |
| 6. Export Engine | JSZip packaging, metadata.json + index.csv/json generation, validation pass | 2 days |
| 7. Testing | Test across devices (Android/iOS browsers), lighting conditions, offline mode | 2–3 days |
| 8. Polish/PWA install | Add-to-home-screen prompt, offline caching, icons | 1 day |

**Total estimate:** ~2–3 weeks for a solo developer MVP.

---

## 10. Suggested Folder Structure (Codebase)

```
student-face-capture-pwa/
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── models/                 ← face-api.js model weights (loaded locally, offline-capable)
├── src/
│   ├── components/
│   │   ├── RegistrationForm.jsx
│   │   ├── CameraCapture.jsx
│   │   ├── QualityOverlay.jsx
│   │   ├── ReviewScreen.jsx
│   │   └── ExportPanel.jsx
│   ├── lib/
│   │   ├── faceDetection.js    ← wraps face-api.js calls, quality checks
│   │   ├── imageProcessing.js  ← resize/compress via Canvas
│   │   ├── db.js               ← IndexedDB wrapper (idb)
│   │   └── exportEngine.js     ← builds zip/csv/json
│   ├── App.jsx
│   └── main.jsx
├── vite.config.js
└── package.json
```

---

## 11. Future Enhancements (post-MVP)
- Backend sync so multiple capture stations feed one central dataset.
- Duplicate-face detection across students (flag if two regNos have visually identical faces — data entry error catch).
- Auto face-embedding generation at export time (so exported dataset includes precomputed embeddings, not just raw images).
- Bulk CSV import of student roster to pre-fill Name/RegNo/Dept/Section, so operator only fills email + captures photos.
