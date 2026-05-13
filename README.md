
# Chat Aid Clinic

Professional, minimal EMR-style appointment and telehealth demo application (backend + frontend) for clinic workflows — authentication, patients, doctors, scheduling/availability, prescriptions, reports and voice/emergency booking integrations.

## Table of contents

- Project overview
- Features
- Tech stack
- Getting started
	- Backend
	- Frontend
- Environment variables
- Seed scripts
- API overview
- Development notes
- Contributing
- License

## Project overview

This repository contains two main parts:

- `Backend/` — Node.js + Express API server with MongoDB via Mongoose. Includes authentication, appointment management, doctor availability, prescriptions, reports, notifications and voice booking integrations.
- `Frontend/` — Vite + React + TypeScript single-page application (client) that consumes the backend API.

The project is organized for local development and testing; integrations with cloud services (Cloudinary, Anthropic, n8n, Google OAuth) are optional and controlled via environment variables.

## Features

- User auth (JWT)
- Patient and doctor CRUD and profiles
- Appointment booking and availability management
- Prescription and report upload/management
- Emergency & voice booking endpoints (Anthropic/voice SDK integration)
- Notification scaffolding

## Tech stack

- Backend: Node.js, Express, Mongoose (MongoDB), JWT, dotenv
- Frontend: React, Vite, TypeScript, TailwindCSS (configs included)
- Optional integrations: Cloudinary (uploads), Anthropic SDK (voice/AI), Google OAuth, n8n

## Getting started

Prerequisites

- Node.js (>=16 recommended)
- npm or pnpm
- MongoDB (local or hosted, e.g. Atlas)

General flow

1. Configure environment variables (see below).
2. Install dependencies and start backend.
3. Install frontend dependencies and run the dev server.

### Backend

1. Open a terminal and install dependencies:

```powershell
cd Backend
npm install
```

2. Create a `.env` file in `Backend/` (example below) and set your values.

3. Start the server:

```powershell
cd Backend
node index.js
# or use nodemon if installed: npx nodemon index.js
```

The backend listens on the port defined by `PORT` (default: 5000). Health check: `GET /api/health`.

### Frontend

1. Open a terminal in `Frontend/` and install deps:

```powershell
cd Frontend
npm install
```

2. Start the dev server:

```powershell
cd Frontend
npm run dev
```

The frontend dev server runs via Vite (default port 5173). The backend CORS config includes `http://localhost:5173`.

## Environment variables

Create a `Backend/.env` file and set at minimum the following variables:

- `MONGO_URI` — MongoDB connection string (required)
- `JWT_SECRET` — Secret used to sign JWT tokens (required)
- `PORT` — Backend port (optional, default `5000`)

Optional / integration variables used in the codebase:

- `JWT_EXPIRES_IN` — Token expiry setting (default `7d` if not set)
- `GOOGLE_CLIENT_ID` — For Google OAuth sign-in flows
- `N8N_URL` — Base URL for n8n integration (defaults to `http://localhost:5678` in code)
- `ANTHROPIC_API_KEY` — API key for Anthropic AI voice/bookings integration
- `CLOUDINARY_URL` or Cloudinary keys — if you wire up `uploadService` to Cloudinary (currently placeholder comments exist in code)

Example `.env` (do not commit this file):

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/chataid
JWT_SECRET=replace_this_with_a_strong_random_value
PORT=5000
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
ANTHROPIC_API_KEY=sk-anthropic-api-key-xxxxx
N8N_URL=http://localhost:5678
```

## Seed scripts

The backend contains a few convenience scripts that connect directly to MongoDB and perform initial seeding or maintenance:

- `Backend/scripts/seedAdmin.js` — create a default admin user
- `Backend/scripts/seedDoctor.js` — create sample doctors
- `Backend/scripts/setAllDoctorsAvailable.js` — utility to mark doctors available
- `Backend/scripts/setDefaultDoctorSlots.js` — initialize default slots

Run them with Node from the `Backend/` folder after setting `MONGO_URI` in your environment or `.env`:

```powershell
cd Backend
node scripts/seedAdmin.js
```

## API overview

The backend exposes the following main route groups (see `Backend/index.js`):

- `POST/GET /api/auth` — authentication and token endpoints
- `/api/patient` and `/api/patients` — patient operations
- `/api/doctor` — doctor operations
- `/api/appointments` — scheduling and appointment management
- `/api/availability` — doctor availability management
- `/api/voice` — voice booking endpoints
- `/api/emergency` — emergency reporting endpoints
- `/api/prescriptions`, `/api/reports`, `/api/notifications`, `/api/nurses` — related resource endpoints

Health check: `GET /api/health` returns a small JSON payload when the server is up.

Authentication

- The API uses JWT tokens. Protect routes by including `Authorization: Bearer <token>` header. See middleware in `Backend/middleware/auth.js`.

## Development notes & tips

- CORS is preconfigured for local development to allow `http://localhost:5173`, `:8080`, and `:3000`.
- File uploads are served from `Backend/uploads/` using a static route. The upload service contains placeholders for Cloudinary integration.
- The backend package.json currently includes dependencies but no `start` script; starting via `node index.js` is the recommended minimal approach. You can add a `start` and `dev` script if you'd like (e.g., using `nodemon`).
- Frontend has linting and tests configured (`eslint`, `vitest`).

## Contributing

1. Fork the repository and create a feature branch.
2. Open a pull request describing the change and why it helps.

Please keep changes small and focused. Add tests for new behavior where appropriate.

## License

This project does not include a license file; add `LICENSE` if you wish to define reuse terms.

## Contact

For questions about the codebase, open an issue or pull request in this repository.

---

Generated README — adapt environment examples to your secrets management workflow and never commit real credentials.
