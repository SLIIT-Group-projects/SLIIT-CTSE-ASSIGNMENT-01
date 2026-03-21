# Hospital Microservices System (MERN)

Microservices hospital workflow using: Node.js + Express + MongoDB + React + Tailwind.

## Microservices (each with its own MongoDB)
- `backend/auth-service/` (JWT + roles)
- `backend/appointment-service/` (doctor schedules + appointment booking)
- `backend/doctor-service/` (clinical notes/prescriptions + lab test requests)
- `backend/lab-service/` (lab requests + report upload after payment)
- `backend/billing-service/` (bill creation + slip upload + ADMIN payment verification)

Frontend:
- `frontend/` (single shared React app)

## Ports (default)
- Frontend: `3000`
- Auth: `4001`
- Appointments: `4002`
- Doctor: `4003`
- Lab: `4004`
- Billing: `4005`

## Required environment files
For each backend service directory, copy:
- `backend/<service>/.env.example` -> `backend/<service>/.env`

For the frontend:
- `frontend/.env.example` -> `frontend/.env`

All services must use the same `JWT_SECRET` and `INTERNAL_SERVICE_TOKEN`.

## Quick start (local demo)
1. Start microservices with Docker:
   - `docker compose up --build`
2. Start the frontend:
   - `cd frontend`
   - `npm start`
3. Open: `http://localhost:3000`

## Workflow (strict)
1. `PATIENT` and `DOCTOR` register/login via `auth-service`.
2. `DOCTOR` sets weekly availability (`POST /doctor/schedule`).
3. `PATIENT` books an appointment (`POST /appointments`) -> status `PENDING_PAYMENT`, Billing creates bill.
4. `PATIENT` uploads slip to Billing or `ADMIN` verifies physical payment.
5. Billing verifies payment and confirms:
   - Appointment Service: `PUT /appointments/confirm/:id` -> appointment becomes `CONFIRMED`.
6. `DOCTOR` records notes/prescription and attends:
   - `PUT /doctor/appointments/:id/clinical` -> appointment becomes `COMPLETED`.
7. `DOCTOR` requests lab tests:
   - Lab Service creates lab request + Billing creates lab bill.
8. `ADMIN` verifies lab payment:
   - Billing Service calls `PUT /lab/confirm-payment/:id` -> payment becomes `PAID`.
9. `LAB_TECH` uploads lab report (only when paid).
10. `PATIENT` views:
   - appointments + prescriptions + lab reports.

## Security/DevOps
- JWT auth + role-based authorization per service
- Helmet + CORS + input validation (zod)
- File upload limits + separate upload folders per service
- Swagger UI at `GET /api-docs` on each backend service
- GitHub Actions workflow: `.github/workflows/ci-microservices.yml` (Snyk scan if `SNYK_TOKEN` is set)
