const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    workingHospital: { type: String, required: true, trim: true },
    speciality: { type: String, required: true, trim: true },
    bio: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);

