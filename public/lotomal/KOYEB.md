# Lotomal on Koyeb

Deploy this directory as the Koyeb service work directory:

- Work directory: `public/lotomal`
- Builder: Buildpack
- Run command: `npm start`
- Service type: Web Service
- Port: `3000` HTTP
- Instance: `free`

The service serves:

- `/` and `/lotomal/` -> game
- `/lotomal/admin.html` -> admin panel
- `/lotomal/overlay.html` -> overlay
- `/api/loto` -> REST fallback
- `/` WebSocket upgrade -> realtime API

Use the Koyeb public URL as `NEXT_PUBLIC_LOTOMAL_URL` for the main site until
`lotomal.paracetamolhaze.ru` is pointed at the Koyeb service.
