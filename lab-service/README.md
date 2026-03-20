# lab-service

Lab workflow microservice:
- Doctor-service creates lab requests (`POST /lab/requests`)
- Lab payment confirmed by Billing Service (`PUT /lab/confirm-payment/:id`)
- Lab tech uploads report only after payment confirmed (`POST /lab/requests/:id/report`)
- Patient views lab reports (`GET /lab/reports`)

Swagger:
- `GET /api-docs`

