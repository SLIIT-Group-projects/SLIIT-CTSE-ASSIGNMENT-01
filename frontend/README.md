# Hospital Microservices Frontend (React + Tailwind)

Single shared React app for all roles.

## Routes
- `/login`
- `/register`
- `/dashboard`
- `/appointments` (PATIENT)
- `/doctor` (DOCTOR)
- `/lab` (PATIENT + LAB_TECH)
- `/billing` (PATIENT)
- `/admin` (ADMIN)

## Setup
1. Copy env:
   - `frontend/.env.example` -> `frontend/.env`
2. Start:
   - `cd frontend`
   - `npm install`
   - `npm start`

## Backend URLs
Configure in `frontend/.env`:
- `REACT_APP_API_GATEWAY_URL` (recommended default: `http://localhost:4000`)
- `REACT_APP_AUTH_URL` (default: `http://localhost:4001`)
- `REACT_APP_APPOINTMENT_URL` (default: `http://localhost:4002`)
- `REACT_APP_DOCTOR_URL` (default: `http://localhost:4003`)
- `REACT_APP_LAB_URL` (default: `http://localhost:4004`)
- `REACT_APP_BILLING_URL` (default: `http://localhost:4005`)

If `REACT_APP_AUTH_URL`/`REACT_APP_APPOINTMENT_URL`/etc are omitted, the app automatically uses the gateway paths:
- `${REACT_APP_API_GATEWAY_URL}/auth-service`
- `${REACT_APP_API_GATEWAY_URL}/appointment-service`
- `${REACT_APP_API_GATEWAY_URL}/doctor-service`
- `${REACT_APP_API_GATEWAY_URL}/lab-service`
- `${REACT_APP_API_GATEWAY_URL}/billing-service`

## JWT
- Stored in `localStorage` as `token`
- UI calls `POST /auth/verify` to determine the user role.
