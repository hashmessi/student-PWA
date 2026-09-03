<!-- GSD:project-start source:PROJECT.md -->
## Project

**Student Face Dataset Collection PWA**

A lightweight, installable Progressive Web App (PWA) for collecting student face datasets to power a Smart Attendance System built on face recognition. Operators register each student (Name, Reg.No, Dept, Section, College Email) and the app guides them through capturing 4 validated face images per student — Front, Left, Right, and Overall — using in-browser face detection quality gates. All data is stored offline in IndexedDB and exported as a clean, per-student ZIP archive ready for direct ingestion by a face-recognition training or embedding pipeline.

**Core Value:** Every export is a perfectly organized, non-mixed, per-student face dataset — each student's photos are isolated in their own `RegNo_Name/` folder with validated metadata so the face-recognition pipeline can be fed without any manual cleanup.

### Constraints

- **Tech stack**: React (Vite) + vite-plugin-pwa + face-api.js (TinyFaceDetector) + IndexedDB (idb) + JSZip + Canvas API — chosen for offline-first PWA footprint with no backend dependency
- **Performance**: Face detection model must run in-browser (WASM); no server round-trips during capture
- **Image standard**: 720×720 JPEG @ 85% quality — uniform across entire dataset
- **Security**: No third-party image upload; consent notice mandatory before first capture
- **Naming**: Folder and file names derived from `RegNo_NameNoSpaces` — RegNo is always the primary identifier
- **Timeline**: Solo developer MVP — estimated 2–3 weeks
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
