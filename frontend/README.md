# Nexora frontend

From this directory, run:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The root redirects to `/login`. The routes
`/login`, `/signup`, and `/dashboard` are public placeholders.

Copy `.env.example` to `.env` if you need local environment settings.
`VITE_API_BASE_URL` is set to `http://localhost:8000` for future API work.
The placeholder pages work independently of the backend.

Run `npm run build` to type-check and generate `dist/`.
Run `npm run preview` to serve that build locally.
