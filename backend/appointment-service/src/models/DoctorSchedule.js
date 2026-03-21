const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0=Sun
    start: { type: String, required: true }, // HH:MM
    end: { type: String, required: true }, // HH:MM
    plannedPatientCount: { type: Number, min: 1, default: null },
  },
  { _id: false }
);

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
    slots: { type: [slotSchema], required: true, default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema);

