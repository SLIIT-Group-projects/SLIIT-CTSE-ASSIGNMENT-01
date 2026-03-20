# appointment-service

Hospital appointment workflow:
- Doctors define weekly availability (`POST /doctor/schedule`)
- Patients view slots (`GET /doctors/:doctorId/available-slots`)
- Patients book appointments (`POST /appointments`) -> creates bill in Billing Service
- Billing Service confirms appointments (`PUT /appointments/confirm/:id`)
- Doctors mark completed after consultation (`PUT /appointments/:id/complete`)

Swagger:
- `GET /api-docs`

