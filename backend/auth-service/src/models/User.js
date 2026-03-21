const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['PATIENT', 'DOCTOR', 'LAB_TECH', 'ADMIN'] },
    medicalProfile: {
      age: { type: Number, default: null },
      heightCm: { type: Number, default: null },
      weightKg: { type: Number, default: null },
      bloodGroup: { type: String, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

