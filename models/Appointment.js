const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
	customer: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	barber: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	service:{
		type: mongoose.Schema.Types.ObjectId,
		ref : 'Service',
		required: true
	},
	startTime: {
		type: Date,
		required: true
	},
	endTime: {
		type: Date,
		required: true
	},
	status: {
		type: String,
		enum: ['scheduled', 'completed', 'cancelled_by_user', 'cancelled_by_barber'],
		default: 'scheduled'
	}
}, { timestamps: true })
const Appointment = mongoose.model('Appointment',appointmentSchema);
module.exports = Appointment;