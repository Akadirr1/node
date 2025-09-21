const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const otpSchema = new Schema({
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['register', 'login', 'password_reset', 'phone_verification'],
        required: true
    },
    attempts: {
        type: Number,
        default: 0,
        max: 3
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        index: { expireAfterSeconds: 0 }
    },
    tempUserData: {
        type: Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

// Ensure only one active OTP per phone number per type
otpSchema.index({ phoneNumber: 1, type: 1 }, { unique: true });

const OTP = mongoose.model('OTP', otpSchema);
module.exports = OTP;