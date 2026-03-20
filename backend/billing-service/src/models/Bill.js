const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    billType: {
      type: String,
      required: true,
      enum: ['APPOINTMENT', 'LAB'],
      index: true,
    },
    referenceId: { type: String, required: true, index: true }, // appointmentId or labRequestId

    patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    amount: { type: Number, required: true },
    currency: { type: String, default: 'LKR' },

    status: {
      type: String,
      required: true,
      enum: ['PENDING_PAYMENT', 'PAID', 'REJECTED'],
      index: true,
      default: 'PENDING_PAYMENT',
    },

    paymentMethod: { type: String, enum: ['BANK_TRANSFER', 'PHYSICAL'], default: 'BANK_TRANSFER' },

    paymentSlipUrl: { type: String, default: null },
    paymentSlipFileName: { type: String, default: null },

    verifiedByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

billSchema.index({ billType: 1, referenceId: 1 }, { unique: true });

module.exports = mongoose.model('Bill', billSchema);

