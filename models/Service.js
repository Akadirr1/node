const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
	name: {
		type: String,
		required: true,
		unique: true,
		trim: true
	},
	duration: {
		type: Number,
		required: true
	},
	price: {
		type: Number,
		required: true
	}
})
const Service = mongoose.model('Service', ServiceSchema);
module.exports = Service;