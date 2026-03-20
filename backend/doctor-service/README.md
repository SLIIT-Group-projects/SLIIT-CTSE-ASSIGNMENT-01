# doctor-service

Clinical documentation microservice:
- Doctor adds `notes` and `prescription` for `CONFIRMED` appointments.
- Doctor requests lab tests (internally calls `lab-service`).

Endpoints:
- `GET /doctor/appointments`
- `PUT /doctor/appointments/:id/clinical`
- `POST /doctor/appointments/:id/lab-request`
- `GET /doctor/clinical/patient`

Swagger:
- `GET /api-docs`

