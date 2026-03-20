const mongoose = require('mongoose');

const labRequestSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    testName: { type: String, required: true, trim: true, index: true },
    notes: { type: String, default: '' },

    // PAYMENT STATUS required by workflow:
    // - PENDING_PAYMENT: report upload blocked
    // - PAID: report upload allowed
    paymentStatus: {
      type: String,
      required: true,
      enum: ['PENDING_PAYMENT', 'PAID'],
      index: true,
      default: 'PENDING_PAYMENT',
    },

    billingBillId: { type: String, default: null },

    reportUrl: { type: String, default: null },
    reportFileName: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LabRequest', labRequestSchema);

