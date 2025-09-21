const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const barberProfileSchema = require('./BarberProfile');

const UserSchema = new Schema({
	name: {
		type: String,
		required: [true, 'Isim alani zorunludur!']
	},
	surname: {
		type: String,
		required: [true, 'Soyisim alani zorunludur!']
	},
	phoneNumber: {
		type: String,
		required: [true, 'Telefon numarası alanı zorunludur!'],
		unique: true

	},
	password: {
		type: String,
		required: [true, 'Şifre alanı zorunludur.'],
		minlength: [6, 'Şifre en az 6 karakter olmalıdır.']
	},
	role: {
		type: String,
		required: true,
		enum: ['customer', 'barber', 'admin'],
		default: 'customer'
	},
	isBanned: {
		type: Boolean,
		default: false
	},
	barberProfile: {
		type: barberProfileSchema,
		required: function () { return this.role === 'barber' }
	}
}, { timestamps: true })

UserSchema.pre('save', async function (next) {
	if (!this.isModified('password')) {
		return next();
	}
	try {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error)
	}
})


const User = mongoose.model('User', UserSchema);
module.exports = User;