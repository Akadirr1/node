const User = require('../models/User');
const getBarbers = async (req, res) => {
	try {
		const barbers = await User.find({
			role: 'barber'
		})
		res.status(200).json(barbers);

	} catch (error) {
		res.status(500).json({ message: 'Sunucu hatası oluştu.', error: error.message });
	}
}
const getBarberProfile = async (req, res) => {
	try {
		const barberId = req.params.id;

		const barber = await User.findById(barberId).select('-password');
		if (!barber || barber.role !== 'barber') {
			return res.status(404).json({ message: 'Berber bulunamadı.' });

		}
		res.status(200).json(barber);
	} catch (error) {
		res.status(500).json({ message: 'Sunucu hatası oluştu.', error: error.message });

	}
}
const updateBarberProfile = async (req, res) => {
	try {
		const barberId = req.params.id;

		const newProfileData = req.body;

		const updatedBarber = await User.findByIdAndUpdate(barberId, {
			$set: {
				'barberProfile': newProfileData
			}
		}, { new: true, runValidators: true }
		).select('-password');
		if (!updatedBarber) {
			return res.status(404).json({ message: 'Güncellenecek berber bulunamadı.' });
		}
		res.status(200).json({ message: 'Profil başarıyla güncellendi.', barber: updatedBarber });

	} catch (error) {
		res.status(500).json({ message: 'Profil güncellenirken bir hata oluştu.', error: error.message });

	}
}

module.exports = {
	getBarberProfile,
	updateBarberProfile,
	getBarbers
};