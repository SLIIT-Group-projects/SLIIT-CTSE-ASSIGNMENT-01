# auth-service

Auth microservice for the hospital system.

## Endpoints
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/verify` (JWT)

Swagger:
- `GET /api-docs`

## Local dev
1. Create `.env` from `.env.example`
2. Run:
   - `docker compose up --build`

## Notes
- JWT payload contains `{ sub, role }`
- Passwords are hashed with `bcrypt`

