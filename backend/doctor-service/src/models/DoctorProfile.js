const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    workingHospital: { type: String, required: true, trim: true },
    speciality: { type: String, required: true, trim: true },
    consultationCharge: { type: Number, required: true, default: 500, min: 0 },
    bio: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);

