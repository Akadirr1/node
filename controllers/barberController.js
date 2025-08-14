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
const updateMyServices = async (req, res) => {
	try {
		const barberId = req.user.id;

		const { servicesOffered } = req.body;
		if (!Array.isArray(servicesOffered)) {
			return res.status(400).json({ message: 'Hizmetler bir dizi formatında gönderilmelidir.' });
		}

		// Yeni hizmet eklemek için $push kullan
		const updatedBarber = await User.findByIdAndUpdate(barberId, {
			$push: { 'barberProfile.servicesOffered': { $each: servicesOffered } }
		}, { new: true, runValidators: true }).populate('barberProfile.servicesOffered.service', 'name');

		if (!updatedBarber) {
			return res.status(404).json({ message: 'Berber bulunamadı.' });
		}

		res.status(200).json({
			message: 'Hizmet başarıyla eklendi.',
			servicesOffered: updatedBarber.barberProfile.servicesOffered
		});

	} catch (error) {
		console.error("Berber hizmetleri güncellenirken hata:", error);
		res.status(500).json({ message: 'Hizmetler güncellenirken bir sunucu hatası oluştu.' });
	}
}
const getMyServices = async (req, res) => {

	try {
		const barberId = req.user.id;

		const user = await User.findById(barberId).select('barberProfile.servicesOffered').populate('barberProfile.servicesOffered.service', 'name defaultDuration');
		if (!user || !user.barberProfile) {
			return res.status(404).json({ message: 'Berber profili bulunamadı.' });
		}

		res.status(200).json(user.barberProfile.servicesOffered)
	} catch (error) {
		console.error("Berberin hizmetleri getirilirken hata:", error);
		res.status(500).json({ message: 'Hizmetler getirilirken bir sunucu hatası oluştu.' });
	}
}
const toggleServiceStatus = async (req, res) => {
	try {
		const barberId = req.user.id;

		const { serviceId } = req.params;

		const barber = await User.findById(barberId).populate('barberProfile.servicesOffered.service', 'name');
		;
		if (!barber || !barber.barberProfile) {
			return res.status(404).json({ message: 'Berber profili bulunamadı.' });
		}

		const serviceToToggle = barber.barberProfile.servicesOffered.find(
			s => s.service._id.toString() === serviceId
		)
		if (!serviceToToggle) {
			return res.status(404).json({ message: 'Hizmet, berberin menüsünde bulunamadı.' });
		}
		console.log(serviceToToggle.service.name);
		serviceToToggle.isActive = !serviceToToggle.isActive;

		await barber.save();
		res.status(200).json({
			message: `'${serviceToToggle.service.name}' hizmetinin durumu güncellendi.`,
			service: serviceToToggle
		});
	} catch (error) {
		console.error("Hizmet durumu güncellenirken hata:", error);
		res.status(500).json({ message: 'Hizmet durumu güncellenirken bir sunucu hatası oluştu.' });
	}
}
const updateBarberServiceDetails = async (req, res) => {
	try {
		const barberId = req.user.id;
		const { serviceId } = req.params;

		const { price, duration } = req.body;

		const barber = await User.findById(barberId)
		if (!barber || !barber.barberProfile) {
			return res.status(404).json({ message: 'Berber profili bulunamadı.' });
		}

		const serviceToUpdate = barber.barberProfile.servicesOffered.find(
			s => s.service.toString() === serviceId
		)
		if (!serviceToUpdate) {
			return res.status(404).json({ message: 'Hizmet, berberin menüsünde bulunamadı.' });
		}
		if (price !== undefined) {
			serviceToUpdate.price = price
		}
		if (duration !== undefined) {
			serviceToUpdate.duration = duration
		}

		await barber.save();

		res.status(200).json({
			message: 'Hizmet detayları başarıyla güncellendi.',
			service: serviceToUpdate
		})
	} catch (error) {
		console.error("Hizmet detayları güncellenirken hata:", error);
		res.status(500).json({ message: 'Hizmet detayları güncellenirken bir sunucu hatası oluştu.' });
	}
}
const getMyAvailability = async (req, res) => {
	try {
		const barberId = req.user.id;

		const user = await User.findById(barberId).select('barberProfile.standardAvailability');
		if (!user || !user.barberProfile) {
			return res.status(404).json({ message: 'Berber profili veya çalışma programı bulunamadı.' });
		}
		res.status(200).json(user.barberProfile.standardAvailability);

	} catch (error) {
		console.error("Berberin programı getirilirken hata:", error);
		res.status(500).json({ message: 'Program getirilirken bir sunucu hatası oluştu.' });

	}
}
const updateMyAvailability = async (req, res) => {
	try {
		const barberId = req.user.id;

		const { availability } = req.body;
		if (!Array.isArray(availability)) {
			return res.status(400).json({ message: 'Program verisi bir dizi formatında gönderilmelidir.' });
		}
		const updatedBarber = await User.findByIdAndUpdate(barberId, {
			$set: { 'barberProfile.standardAvailability': availability }
		},
			{ new: true, runValidators: true }
		).select('barberProfile.standardAvailability');
		if (!updatedBarber) {
			return res.status(404).json({ message: 'Berber bulunamadı.' });
		}
		res.status(200).json({
			message: 'Haftalık çalışma programınız başarıyla güncellendi.',
			availability: updatedBarber.barberProfile.standardAvailability
		})
	} catch (error) {
		console.error("Berber programı güncellenirken hata:", error);
		res.status(500).json({ message: 'Program güncellenirken bir sunucu hatası oluştu.' });

	}
}
const getMyTimeOffs = async (req, res) => {
	try {
		const barberId = req.user.id;

		const user = await User.findById(barberId).select('barberProfile.timeOffs')
		if (!user || !user.barberProfile) {
			return res.status(404).json({
				message: 'Berber profili veya izinleri bulunamadı.'
			})
		}
		const sortedTimeOffs = user.barberProfile.timeOffs.sort((a, b) => a.startTime - b.startTime)
		res.status(200).json(sortedTimeOffs)
	} catch (error) {
		console.error("İzinler getirilirken hata:", error);
		res.status(500).json({ message: 'İzinler getirilirken bir sunucu hatası oluştu.' });
	}
}
const addMyTimeOffs = async (req, res) => {
	try {
		const barberId = req.user.id;

		const { reason, startTime, endTime } = req.body;
		if (!startTime || !endTime) {
			return res.status(400).json({ message: 'Başlangıç ve bitiş zamanı zorunludur.' });
		}
		const barber = await User.findById(barberId);
		if (!barber || !barber.barberProfile) {
			return res.status(404).json({ message: 'Berber profili bulunamadı.' });
		}
		barber.barberProfile.timeOffs.push({ reason, startTime, endTime });
		await barber.save();

		res.status(201).json({
			message: 'Yeni izin başarıyla eklendi.',
			timeOffs: barber.barberProfile.timeOffs
		})
	} catch (error) {
		console.error("İzin eklenirken hata:", error);
		res.status(500).json({ message: 'İzin eklenirken bir sunucu hatası oluştu.' })
	}
}
const deleteMyTimeOff = async (req, res) => {
	try {
		const barberId = req.user.id;
		const { timeOffId } = req.params;
		const barber = await User.findById(barberId);
		if (!barber || !barber.barberProfile) {
			return res.status(404).json({ message: 'Berber profili bulunamadı.' });
		}
		barber.barberProfile.timeOffs.pull({ _id: timeOffId })

		await barber.save();
		res.status(200).json({
			message: 'İzin başarıyla silindi.',
			timeOffId: timeOffId
		});
	} catch (error) {
		console.error("İzin silinirken hata:", error);
		res.status(500).json({ message: 'İzin silinirken bir sunucu hatası oluştu.' });

	}
}
const getServicesByBarber = async (req, res) => {
	try {
		const { id } = req.params;
		const barber = await User.findById(id).select('barberProfile.servicesOffered').populate('barberProfile.servicesOffered.service');

		if (!barber || !barber.barberProfile) {
			return res.status(404).json({ message: 'Berber veya profil bilgileri bulunamadı.' });
		}
		const activeServices = barber.barberProfile.servicesOffered.filter(offeredService => offeredService.isActive);
		res.status(200).json(activeServices);

	} catch (error) {
		console.error("Berberin hizmetleri getirilirken hata:", error);
		res.status(500).json({ message: 'Hizmetler getirilirken bir sunucu hatası oluştu.' });

	}
}
module.exports = {
	getBarberProfile,
	updateBarberProfile,
	getBarbers,
	updateMyServices,
	getMyServices,
	toggleServiceStatus,
	updateBarberServiceDetails,
	updateMyAvailability,
	getMyAvailability,
	getMyTimeOffs,
	addMyTimeOffs,
	deleteMyTimeOff,
	getServicesByBarber
};