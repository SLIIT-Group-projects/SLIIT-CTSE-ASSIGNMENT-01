# billing-service

Payment/billing workflow driver:
- Services call internal endpoints to create bills for appointments/lab requests.
- Patients upload slips to Billing Service.
- ADMIN verifies payments in Billing Service.
- Billing Service confirms:
  - appointments (`PUT /appointments/confirm/:id` on appointment-service)
  - lab requests (`PUT /lab/confirm-payment/:id` on lab-service)

Swagger:
- `GET /api-docs`

