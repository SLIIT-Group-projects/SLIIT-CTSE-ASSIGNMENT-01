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
    billingBillId: { type: String, default: null },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctorId: 1, date: 1, startTime: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);

