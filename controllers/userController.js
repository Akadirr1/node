const User = require('../models/User');
const Appointment = require('../models/Appointment')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const createBarber = async (req, res) => {
	const { name, surname, phoneNumber, password, barberProfile } = req.body;

	try {
		const newUser = new User({
			name,
			surname,
			phoneNumber,
			password,
			role: 'barber',
			barberProfile
		});

		const savedUser = await newUser.save();

		savedUser.password = undefined;
		res.status(201).json({ message: 'barber created sucess', user: savedUser })
	} catch (error) {
		if (error.code === 11000) {
			res.status(400).json({ message: 'This number already taken' })
		}
		else {
			res.status(500).json({ message: 'barber save error', error: error.message })
		}
	}
}
const createUser = async (req, res) => {
	const { name, surname, phoneNumber, password } = req.body;

	try {
		const newUser = new User({
			name,
			surname,
			phoneNumber,
			password,
		})

		const savedUser = await newUser.save();
		savedUser.password = undefined;

		res.status(201).json({ message: 'user save succsess', savedUser })
	} catch (error) {
		if (error.code === 11000) {
			res.status(400).json({ message: 'this number already taken' });
		}
		res.status(500).json({ message: 'user save error', error: error.message })
	}
}
const loginUser = async (req, res) => {
	try {
		const { phoneNumber, password } = req.body;

		const user = await User.findOne({ phoneNumber });
		if (!user) {
			return res.status(401).json({ message: 'Kullanici bulunamadi' });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(401).json({ message: ' Hatali sifre' });
		}

		const payload = {
			id: user._id,
			role: user.role,
			name: user.name
		};

		const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

		res.cookie('token', token, {
			httpOnly: true,
			//secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: 60 * 60 * 1000
		})
		res.status(200).json({ message: 'Giris basarili', user: payload })
	} catch (error) {
		res.status(500).json({ message: 'Sunucu hatası.', error: error.message });

	}
}
const getMe = (req, res) => {
	// 'protect' middleware'i bu rotadan önce çalışıp, token'ı doğrulayıp
	// kullanıcıyı 'req.user' içine koyduğu için, bizim burada tek yapmamız
	// gereken o kullanıcıyı geri göndermek.
	// Eğer token geçerli değilse, 'protect' middleware'i zaten hata döndüreceği için
	// bu fonksiyona istek hiç ulaşmaz.
	res.status(200).json(req.user);
};
const getAppointments = async (req, res) => {
	const { _id } = req.user;
	const user = await User.findOne({ _id });
	if (!user) {
		return res.status(401).json({ message: 'Kullanici bulunamadi' });
	}

	const appointments = await Appointment.find({
		customer: _id
	})
	return res.status(200).json({ Appointments: appointments })
}
const logOut = (req, res) => {
	res.cookie('token', '', {
		httpOnly: true,
		expires: new Date(0)
	});
	res.status(200).json({ message: 'Başarıyla çıkış yapıldı.' });

}
//api/appointment/delete:id olsun 

module.exports = { createBarber, createUser, loginUser, getMe, logOut, getAppointments };