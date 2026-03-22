const mongoose = require('mongoose');

const labRequestSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    testName: { type: String, required: true, trim: true, index: true },
    notes: { type: String, default: '' },

    priority: {
      type: String,
      required: true,
      enum: ['NORMAL', 'URGENT'],
      default: 'NORMAL',
      index: true,
    },

    // Lab processing (LAB_TECH): QUEUED → IN_PROGRESS → COMPLETED (on upload)
    labStatus: {
      type: String,
      required: true,
      enum: ['QUEUED', 'IN_PROGRESS', 'COMPLETED'],
      default: 'QUEUED',
      index: true,
    },

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
    reportRemarks: { type: String, default: '', maxlength: 500 },

    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    replacedAt: { type: Date, default: null },

    /** Legacy flag; prefer emailNotifiedAt for email notifications */
    patientNotified: { type: Boolean, default: false },
    /** When patient was emailed about this completed report (lab tech action) */
    emailNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LabRequest', labRequestSchema);

