# Nextflow

A visual AI workflow builder built with Next.js. Design node-based pipelines on a canvas, upload inputs, run workflows in the background, and review execution history — all with per-user auth and persistence.

## Features

- **Visual workflow builder** — drag-and-drop canvas powered by React Flow
- **Built-in nodes** — Request Inputs, Crop Image, Gemini, and Response
- **Image uploads** — Transloadit (recommended) with local fallback for `image_field`
- **Background execution** — Trigger.dev orchestrates crop, Gemini, and workflow runs
- **Run history** — per-node status, timing, inputs/outputs, and error details
- **Dashboard** — create, rename, duplicate, and delete workflows
- **Import / export** — JSON workflow documents with a sample workflow loader
- **Auth** — Clerk sign-in/sign-up with protected routes
- **Autosave** — debounced graph persistence to PostgreSQL

## Tech stack

| Layer | Tools |
| --- | --- |
| App | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Canvas | React Flow |
| Auth | Clerk |
| Database | PostgreSQL (Neon) + Prisma |
| Jobs | Trigger.dev v4 |
| AI | Google Gemini API |
| Uploads | Transloadit (optional local fallback) |
| Images | Sharp |

## Workflow nodes

| Node | Purpose |
| --- | --- |
| **Request Inputs** | Default text and image inputs (`text_field`, `image_field`) |
| **Crop Image** | Percentage-based crop of an upstream image |
| **Gemini 3.1 Pro** | Vision + text generation with temperature and token limits |
| **Response** | Final workflow output |

Connect nodes by dragging handles. Request Inputs and Response are always present on the canvas.

## Troubleshooting

### Clerk: “Infinite redirect loop” / session token refresh

This usually happens for one of these reasons:

1. **Publishable and secret keys are from different Clerk apps** — In [Clerk Dashboard](https://dashboard.clerk.com) → your app → **API Keys**, copy **both** keys again into `.env.local`, then restart `npm run dev`.
2. **Browser URL does not match `NEXT_PUBLIC_APP_URL`** — If you open `http://10.x.x.x:3000`, set `NEXT_PUBLIC_APP_URL` to that same URL (not `localhost`).
3. **Stale cookies** — Clear site data for your dev host (especially `__client_uat` and Clerk session cookies), or use a private/incognito window.
4. **LAN / network access** — Add your machine IP to `ALLOWED_DEV_ORIGINS` in `.env.local` and restart the dev server. In Clerk Dashboard → **Configure** → **Domains**, allow your dev origin if required.

### Next.js: “Blocked cross-origin request” in dev

Add the IP shown in the terminal to `ALLOWED_DEV_ORIGINS` in `.env.local` (comma-separated), or use the defaults in `next.config.ts`. Restart `npm run dev` after changing env vars.

## Prerequisites

- Node.js 20+
- npm
- A [Clerk](https://clerk.com) application
- A PostgreSQL database ([Neon](https://neon.tech) recommended)
- A [Trigger.dev](https://trigger.dev) project
- A [Google AI Studio](https://aistudio.google.com) Gemini API key
- *(Optional)* [Transloadit](https://transloadit.com) credentials for cloud image uploads

## Getting started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd nextflow
npm install
```

### 2. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DATABASE_URL` | PostgreSQL connection string (use Neon **pooled** URL for runtime) |
| `TRIGGER_SECRET_KEY` | Trigger.dev secret key |
| `TRIGGER_PROJECT_REF` | Trigger.dev project ref |
| `GEMINI_API_KEY` | Google Gemini API key (server-side only) |
| `GEMINI_MODEL` | Model name — `gemini-1.5-flash` (default) or `gemini-2.5-flash` |
| `NEXT_PUBLIC_APP_URL` | App URL, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY` | Transloadit auth key (public) |
| `TRANSLOADIT_AUTH_SECRET` | Transloadit auth secret (server-side only) |
| `TRANSLOADIT_TEMPLATE_ID` | *(Optional)* Transloadit template ID |
| `DEMO_MODE` | Set `true` to skip Gemini calls for pipeline demos |
| `GEMINI_DEBUG` | Set `true` for Gemini debug logs in Trigger workers |

> **Never commit `.env.local` or real secrets.** Only `.env.example` belongs in git (with empty placeholders).

### 3. Database setup

```bash
npm run db:push
# or
npm run db:migrate
```

### 4. Run locally

Start the Next.js app and Trigger.dev worker in **two terminals**:

```bash
# Terminal 1 — web app
npm run dev
```

```bash
# Terminal 2 — background jobs
npm run trigger:dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, and open the dashboard to create a workflow.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Generate Prisma client and production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run trigger:dev` | Start Trigger.dev dev worker |
| `npm run db:push` | Push Prisma schema to the database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Project structure

```
app/                  # Next.js App Router pages (dashboard, workflow builder, auth)
actions/              # Server actions (CRUD, execution, uploads)
components/           # UI and workflow builder components
lib/
  workflow/           # Canvas, import/export, execution engine, DAG
  upload/             # Transloadit + image upload helpers
prisma/               # Database schema
trigger/              # Trigger.dev tasks (orchestrator, crop, gemini)
types/                # Shared TypeScript types
```

## Running a workflow

1. Open a workflow from the dashboard.
2. Configure **Request Inputs** (text and/or image).
3. Add and connect **Crop Image** and/or **Gemini** nodes as needed.
4. Click **Run** — the orchestrator executes nodes in dependency order.
5. Open **History** to inspect per-node results.

Image uploads persist `fileUrl` and metadata only; upload progress UI state stays in the component and is not saved to the graph.

## Import / export

Use the builder toolbar to:

- **Export JSON** — download the current workflow graph
- **Import JSON** — load a saved workflow document
- **Load sample** — insert the built-in assignment sample workflow

## Deployment notes

- Set all environment variables in your hosting provider (Vercel, etc.) and Trigger.dev project settings.
- Use a **pooled** Neon connection string for the app runtime.
- Deploy Trigger.dev tasks separately (`trigger deploy`) and keep `trigger:dev` running locally during development.
- Set `NEXT_PUBLIC_APP_URL` to your production URL so local asset paths resolve correctly at runtime.
- Gemini and Transloadit secrets must remain server-side; only public keys belong in `NEXT_PUBLIC_*` variables.

## License

Private — all rights reserved unless otherwise specified.
