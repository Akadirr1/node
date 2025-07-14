const User = require('../models/User');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');
const { set } = require('../models/BarberProfile');
const getAvailableSlots = async (req, res) => {
	try {
		const { date } = req.query;
		const { barberId } = req.params;
		const serviceDuration = 60;
		if (!date) {
			return res.status(400).json({ message: 'gecerli bir tarih gerekli' })
		}

		const selectedDate = new Date(date);
		const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
		const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

		const barber = await User.findById(barberId);
		if (!barber || barber.role !== 'barber') {
			return res.status(404).json({ message: 'Berber bulunamadı.' });
		}
		// barberProfile kontrolü ekle
		if (!barber.barberProfile) {
			return res.status(400).json({ message: 'Berber profili bulunamadı.' });
		}

		const allAppointments = await Appointment.find({});
		// Filtreleme işlemini JS ile yap
		const appointmentsOnDay = allAppointments.filter(app =>
			app.barber == barberId &&
			app.startTime >= startOfDay &&
			app.startTime <= endOfDay
		);
		console.log(appointmentsOnDay);
		const dayOfWeek = startOfDay.getDay();
		// standardAvailability kontrolü ekle
		if (!barber.barberProfile.standardAvailability) {
			return res.status(400).json({ message: 'Berber çalışma saatleri tanımlanmamış.' });
		}
		const schedule = barber.barberProfile.standardAvailability.find(d => d.dayOfWeek == dayOfWeek);

		if (!schedule) {
			return res.json([]); // Berber o gün çalışmıyorsa, boş liste döndür.
		}

		// 3b. Olası Tüm Randevu Saatlerini Oluştur

		const potentialSlots = [];
		const [startH, startM] = schedule.startTime.split(':').map(Number);
		const [endH, endM] = schedule.endTime.split(':').map(Number);

		const startTime = new Date(selectedDate);
		startTime.setUTCHours(startH, startM, 0, 0);

		const endTime = new Date(selectedDate);
		endTime.setUTCHours(endH, endM, 0, 0);

		let currentSlotTime = new Date(startTime);

		while (currentSlotTime < endTime) {
			potentialSlots.push(new Date(currentSlotTime));
			currentSlotTime.setTime(currentSlotTime.getTime() + serviceDuration * 60 * 1000);
		}

		// 3c. Potansiyel Saatleri, İzinler ve Dolu Randevular ile Filtrele
		const availableSlots = potentialSlots.filter(slot => {
			const slotEnd = new Date(slot.getTime() + serviceDuration * 60 * 1000);

			// berber izinli mi kontrol et
			const isDuringTimeOff = barber.barberProfile.timeOffs && barber.barberProfile.timeOffs.length > 0 &&
				barber.barberProfile.timeOffs.some(off => {
					const offStart = new Date(off.startTime);
					const offEnd = new Date(off.endTime);
					return slot < offEnd && offStart < slotEnd;
				});

			// barber dolu mu kontrol et
			const isBooked = appointmentsOnDay.some(book => {
				if (book.status == "cancelled_by_user") {
					setTimeout(async () => {
						try {
							await Appointment.findByIdAndDelete(book._id);
							console.log(`İptal edilmiş randevu silindi: ${book._id}`);
						} catch (error) {
							console.error('Randevu silinirken hata:', error);

						}
					})
					return false;
				}
				const bookStart = new Date(book.startTime);
				const bookEnd = new Date(book.endTime);
				console.log(`Comparing slot ${slot.toISOString()} with booking ${bookStart.toISOString()} - ${bookEnd.toISOString()}`);
				return slot < bookEnd && bookStart < slotEnd;
			});
			console.log(`Slot: ${slot.toISOString()}, isDuringTimeOff: ${isDuringTimeOff}, isBooked: ${isBooked}`); // Debug için

			return !isDuringTimeOff && !isBooked;
		})
		res.status(200).json(availableSlots);

	} catch (error) {
		console.error("Müsaitlik alınırken hata:", error);
		res.status(500).json({ message: 'Müsait saatler getirilirken bir sunucu hatası oluştu.' });

	}
}

const createAppointment = async (req, res) => {
	try {
		const customerId = req.user.id;
		const { barberId, startTime } = req.body;
		const serviceDuration = 60;


		const appointmentStarTime = new Date(startTime);
		const appointmentEndTime = new Date(appointmentStarTime.getTime() + serviceDuration * 60 * 1000);

		const existingAppointment = await Appointment.findOne({
			barber: barberId,
			startTime: appointmentStarTime
		})

		if (existingAppointment) {
			return res.status(409).json({ message: 'Üzgünüz, bu saat dilimi az önce başkası tarafından alındı.' }); // 409 Conflict
		}

		const newAppointment = new Appointment({
			customer: customerId,
			barber: barberId,
			startTime: appointmentStarTime,
			endTime: appointmentEndTime,

		})

		await newAppointment.save();
		res.status(201).json({ message: 'Randevunuz başarıyla oluşturuldu.', appointment: newAppointment });
	} catch (error) {
		console.error("Randevu oluşturulurken hata:", error);
		res.status(500).json({ message: 'Randevu oluşturulurken bir sunucu hatası oluştu.' });

	}
}

module.exports = {
	getAvailableSlots,
	createAppointment
}