const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:MM
    endTime: { type: String, required: true }, // HH:MM
    status: {
      type: String,
      required: true,
      enum: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'],
      index: true,
    },
    patientNumber: { type: Number, default: null },
    remainingPatientCount: { type: Number, default: null },
    estimatedTimeMinutes: { type: Number, default: null }, // per-patient screening duration
    estimatedWaitMinutes: { type: Number, default: null }, // queue wait before this patient starts
    estimatedAppointmentTime: { type: String, default: null }, // HH:MM
    billingBillId: { type: String, default: null },
    previousReports: {
      type: [
        {
          title: { type: String, required: true },
          summary: { type: String, default: '' },
          reportUrl: { type: String, default: '' },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctorId: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);

