const mongoose = require('mongoose');

const clinicalSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    notes: { type: String, default: '' },
    prescription: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClinicalRecord', clinicalSchema);

