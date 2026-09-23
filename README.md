# Marzia Saidi Portfolio

Greenfield foundation for a cinematic design engineering portfolio. Stage 1 establishes the application, content model, design tokens, subsystem boundaries, reference assets, and validation workflow. It does not implement the final homepage experience.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Commands

```bash
npm install
npm run dev
npm run format
npm run format:check
npm run lint
npm run validate:content
npm run typecheck
npm run build
npm run validate
```

The development server is available at [http://localhost:3000](http://localhost:3000).

## Project map

- `src/app`: App Router routes, metadata, and global stylesheet entry point
- `src/components`: React presentation and layout components
- `src/content`: typed, static site and project content
- `src/styles`: centralized design tokens and reset rules
- `src/motion`: future motion and scroll orchestration boundary
- `src/webgl`: future Three.js or React Three Fiber boundary
- `src/sound`: future sound engine boundary
- `public/images/projects`: project media served by Next.js
- `design/references`: approved visual references, never imported into production
- `docs`: architecture, creative direction, content guidance, and progress

Read [docs/architecture.md](docs/architecture.md) before adding a new system or dependency.
Project editing procedures are documented in [docs/how-to-add-or-replace-project.md](docs/how-to-add-or-replace-project.md).
