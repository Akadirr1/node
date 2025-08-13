const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Bu şema, berberin "genellikle" ne zaman çalıştığını tanımlar.
const standardAvailabilitySchema = new Schema({
	// JavaScript'in Date.getDay() metoduyla uyumlu olması için sayı kullanıyoruz:
	// 0 = Pazar, 1 = Pazartesi, 2 = Salı, ...
	dayOfWeek: {
		type: Number,
		required: true,
		min: 0,
		max: 6
	},
	// Başlangıç ve bitiş saatlerini "HH:MM" formatında string olarak saklamak,
	// arayüzde göstermek ve basitçe işlemek için en kolay yoldur.
	startTime: {
		type: String,
		required: true,
		match: /^([01]\d|2[0-3]):([0-5]\d)$/ // "HH:MM" formatını zorunlu kılar
	},
	endTime: {
		type: String,
		required: true,
		match: /^([01]\d|2[0-3]):([0-5]\d)$/
	}
}, { _id: false }); // Bu alt-dökümanlar için ayrı bir "_id" alanı oluşturma. Gerek yok.

const timeOffSchema = new Schema({
	reason: {
		type: String,
		default: "Musait degil"
	},
	startTime: {
		type: Date,
		required: true
	},
	endTime: {
		type: Date,
		required: true
	}
}, { _id: false });
const barberServiceSchema = new Schema({

	service: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Service',
		required: true
	},
	price: {
		type: Number,
		required: true
	},
	duration: {
		type: Number,
		required: true
	},
	isActive: {
		type: Boolean,
		required: true,
		default:true
	}

}, { _id: false })
const barberProfileSchema = new Schema({
	standardAvailability: [standardAvailabilitySchema],
	timeOffs: [timeOffSchema],
	servicesOffered: [barberServiceSchema]
})

module.exports = barberProfileSchema;