const User = require('../models/User');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');
const { set } = require('../models/BarberProfile');
const Service = require('../models/Service');
const getAvailableSlots = async (req, res) => {
	try {
		const { date, serviceId } = req.query;
		const { barberId } = req.params;
		const slotIncrement = 30;

		if (!date || !serviceId) {
			return res.status(400).json({ message: 'Lütfen bir tarih ve hizmet seçin.' })
		}
		const service = await Service.findById(serviceId);
		if (!service) {
			return res.status(404).json({ message: 'Seçilen hizmet bulunamadı.' });
		}
		const serviceDuration = service.duration;
		const selectedDate = new Date(date + 'T00:00:00.000Z'); // Force UTC
		const startOfDay = new Date(selectedDate);
		startOfDay.setUTCHours(0, 0, 0, 0);
		const endOfDay = new Date(selectedDate);
		endOfDay.setUTCHours(23, 59, 59, 999);

		const barber = await User.findById(barberId);
		if (!barber || barber.role !== 'barber') {
			return res.status(404).json({ message: 'Berber bulunamadı.' });
		}
		// barberProfile kontrolü ekle
		if (!barber.barberProfile) {
			return res.status(400).json({ message: 'Berber profili bulunamadı.' });
		}

		// İptal edilmiş randevuları sil
		await Appointment.deleteMany({
			barber: barberId,
			startTime: { $gte: startOfDay, $lte: endOfDay },
			$or: [
				{ status: "cancelled_by_user" },
				{ status: "cancelled_by_barber" }
			]
		});

		const allAppointments = await Appointment.find({});
		// Filtreleme işlemini JS ile yap
		const appointmentsOnDay = allAppointments.filter(app =>
			app.barber == barberId &&
			app.startTime >= startOfDay &&
			app.startTime <= endOfDay
		);
		let busySlots = [
			...barber.barberProfile.timeOffs.map(off => ({ startTime: off.startTime, endTime: off.endTime })),
			...appointmentsOnDay.map(appt => ({ startTime: appt.startTime, endTime: appt.endTime }))
		];
		busySlots.sort((a, b) => a.startTime - b.startTime);
		// --- 3. "BOŞ ZAMAN ARALIKLARINI" (GAPS) HESAPLAMA ---
		const schedule = barber.barberProfile.standardAvailability.find(d => d.dayOfWeek === startOfDay.getUTCDay());
		if (!schedule) {
			return res.json([]); // O gün çalışma günü değil.
		}

		const [startH, startM] = schedule.startTime.split(':').map(Number);
		const workStartTime = new Date(startOfDay);
		workStartTime.setUTCHours(startH, startM, 0, 0);

		const [endH, endM] = schedule.endTime.split(':').map(Number);
		const workEndTime = new Date(startOfDay);
		workEndTime.setUTCHours(endH, endM, 0, 0);

		const gaps = [];
		let previousEndTime = workStartTime;

		// Meşguliyet listesini gezip aradaki boşlukları bul
		busySlots.forEach(busySlot => {
			if (busySlot.startTime > previousEndTime) {
				gaps.push({ gapStart: previousEndTime, gapEnd: busySlot.startTime });
			}
			previousEndTime = busySlot.endTime > previousEndTime ? busySlot.endTime : previousEndTime;
		});

		// Son meşguliyetten gün sonuna kadar olan boşluğu da ekle
		if (workEndTime > previousEndTime) {
			gaps.push({ gapStart: previousEndTime, gapEnd: workEndTime });
		}

		// --- 4. HİZMETİ BOŞLUKLARA SIĞDIRIP NİHAİ SAATLERİ ÜRETME ---
		const availableSlots = [];
		gaps.forEach(gap => {
			const gapDuration = (gap.gapEnd - gap.gapStart) / (1000 * 60); // Boşluğun süresi (dakika)

			if (gapDuration >= serviceDuration) {
				let potentialStartTime = new Date(gap.gapStart);

				while (potentialStartTime.getTime() + serviceDuration * 60 * 1000 <= gap.gapEnd.getTime()) {
					availableSlots.push(new Date(potentialStartTime));
					potentialStartTime.setTime(potentialStartTime.getTime() + slotIncrement * 60 * 1000);
				}
			}
		});

		res.status(200).json(availableSlots);
		//console.log(appointmentsOnDay);
		//const dayOfWeek = startOfDay.getDay();
		//// standardAvailability kontrolü ekle
		//if (!barber.barberProfile.standardAvailability) {
		//	return res.status(400).json({ message: 'Berber çalışma saatleri tanımlanmamış.' });
		//}
		//const schedule = barber.barberProfile.standardAvailability.find(d => d.dayOfWeek == dayOfWeek);

		//if (!schedule) {
		//	return res.json([]); // Berber o gün çalışmıyorsa, boş liste döndür.
		//}

		//// 3b. Olası Tüm Randevu Saatlerini Oluştur

		//const potentialSlots = [];
		//const [startH, startM] = schedule.startTime.split(':').map(Number);
		//const [endH, endM] = schedule.endTime.split(':').map(Number);

		//const startTime = new Date(selectedDate);
		//startTime.setUTCHours(startH, startM, 0, 0);

		//const endTime = new Date(selectedDate);
		//endTime.setUTCHours(endH, endM, 0, 0);

		//let currentSlotTime = new Date(startTime);

		//while (currentSlotTime < endTime) {
		//	potentialSlots.push(new Date(currentSlotTime));
		//	currentSlotTime.setTime(currentSlotTime.getTime() + serviceDuration * 60 * 1000);
		//}

		//// 3c. Potansiyel Saatleri, İzinler ve Dolu Randevular ile Filtrele
		//const availableSlots = potentialSlots.filter(slot => {
		//	const slotEnd = new Date(slot.getTime() + serviceDuration * 60 * 1000);

		//	// berber izinli mi kontrol et
		//	const isDuringTimeOff = barber.barberProfile.timeOffs && barber.barberProfile.timeOffs.length > 0 &&
		//		barber.barberProfile.timeOffs.some(off => {
		//			const offStart = new Date(off.startTime);
		//			const offEnd = new Date(off.endTime);
		//			return slot < offEnd && offStart < slotEnd;
		//		});

		//	// barber dolu mu kontrol et
		//	const isBooked = appointmentsOnDay.some(book => {
		//		if (book.status == "cancelled_by_user") {
		//			setTimeout(async () => {
		//				try {
		//					await Appointment.findByIdAndDelete(book._id);
		//					console.log(`İptal edilmiş randevu silindi: ${book._id}`);
		//				} catch (error) {
		//					console.error('Randevu silinirken hata:', error);

		//				}
		//			})
		//			return false;
		//		}
		//		const bookStart = new Date(book.startTime);
		//		const bookEnd = new Date(book.endTime);
		//		console.log(`Comparing slot ${slot.toISOString()} with booking ${bookStart.toISOString()} - ${bookEnd.toISOString()}`);
		//		return slot < bookEnd && bookStart < slotEnd;
		//	});
		//	console.log(`Slot: ${slot.toISOString()}, isDuringTimeOff: ${isDuringTimeOff}, isBooked: ${isBooked}`); // Debug için

		//	return !isDuringTimeOff && !isBooked;
		//})
	} catch (error) {
		console.error("Müsaitlik alınırken hata:", error);
		res.status(500).json({ message: 'Müsait saatler getirilirken bir sunucu hatası oluştu.' });

	}
}

const createAppointment = async (req, res) => {
	try {
		const customerId = req.user.id;
		const { barberId, serviceId, startTime } = req.body;


		if (!barberId || !serviceId || !startTime) {
			return res.status(400).json({ message: 'Berber, hizmet ve başlangıç saati zorunludur.' });
		}
		const barber = await User.findById(barberId);
		if (!barber || barber.role !== 'barber' || !barber.barberProfile) {
			return res.status(404).json({ message: 'Geçerli bir berber bulunamadı.' });
		}
		const offeredService = barber.barberProfile.servicesOffered.find(
			s => s.service.toString() === serviceId
		);
		if (!offeredService) {
			return res.status(404).json({ message: 'Hizmet bulunamadı.' });
		}
		const serviceDuration = offeredService.duration;

		const appointmentStartTime = new Date(startTime);
		const appointmentEndTime = new Date(appointmentStartTime.getTime() + serviceDuration * 60 * 1000);

		const existingAppointment = await Appointment.findOne({
			barber: barberId,
			// Sadece başlangıç saatini değil, tüm zaman aralığını kontrol etmek daha güvenlidir.
			$or: [
				{ startTime: { $lt: appointmentEndTime, $gte: appointmentStartTime } },
				{ endTime: { $gt: appointmentStartTime, $lte: appointmentEndTime } }
			]
		});

		if (existingAppointment) {
			return res.status(409).json({ message: 'Üzgünüz, bu saat dilimi az önce başkası tarafından alındı.' }); // 409 Conflict
		}

		const newAppointment = new Appointment({
			customer: customerId,
			barber: barberId,
			service: serviceId,
			startTime: appointmentStartTime,
			endTime: appointmentEndTime,

		})

		await newAppointment.save();
		res.status(201).json({ message: 'Randevunuz başarıyla oluşturuldu.', appointment: newAppointment });
	} catch (error) {
		console.error("Randevu oluşturulurken hata:", error);
		res.status(500).json({ message: 'Randevu oluşturulurken bir sunucu hatası oluştu.' });

	}
}
const getMyBarberAppointments = async (req, res) => {
	try {
		const barberId = req.user.id;
		const appointment = await Appointment.find({
			barber: barberId,
			status: 'scheduled',
			startTime: { $gte: new Date() }
		})
			.populate('customer', 'name surname')
			.populate('service', 'name duration')
			.sort({ startTime: 'asc' });
		res.status(200).json(appointment);

	} catch (error) {
		console.error("Berber randevuları getirilirken hata:", error);
		res.status(500).json({ message: 'Randevular getirilirken bir sunucu hatası oluştu.' });
	}
}
const cancelAppointment = async (req, res) => {
	try {
		const user = req.user;
		const appointmentId = req.params.id;
		const appointment = await Appointment.findById(appointmentId);
		if (!appointment) {
			return res.status(404).json({ message: 'İptal edilecek randevu bulunamadı.' });
		}
		const isCustomer = user.id == appointment.customer;
		const isBarber = user.id == appointment.barber;
		console.log(isCustomer + isBarber);
		if (!isCustomer && !isBarber && user.role !== 'admin') {
			// Eğer ne randevunun sahibi ne de ilgili berber değilse (ve admin de değilse)
			return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' }); // 403 Forbidden
		}
		if (appointment.status === "completed" || appointment.status === "cancelled_by_user" || appointment.status === "cancelled_by_barber") {
			return res.status(400).json({ message: 'Bu randevu zaten tamamlanmış veya iptal edilmiş.' });
		}

		appointment.status = user.role === 'customer' ? 'cancelled_by_user' : 'cancelled_by_barber';

		await appointment.save();
		res.status(200).json({ message: 'Randevu başarıyla iptal edildi.', appointment });

	} catch (error) {
		console.error("Randevu iptal edilirken hata:", error);
		res.status(500).json({ message: 'Randevu iptal edilirken bir sunucu hatası oluştu.' });

	}
}
const createAppointmentByBarber = async (req, res) => {
	try {
		const barber = req.user;
		barber.populate('barberProfile.servicesOffered.service', 'name');

		const { customerId,         // Kayıtlı müşteri varsa ID'si gelecek
			guestName,          // Misafir ise adı
			guestSurname,       // Misafir ise soyadı
			guestPhone,         // Misafir ise telefonu
			serviceId,
			startTime } = req.body;

		if (!serviceId || !startTime) {
			return res.status(400).json({ message: 'Müşteri, hizmet ve başlangıç saati zorunludur.' });
		}
		const service = barber.barberProfile.servicesOffered.find(
			s => s.service._id.toString() === serviceId
		)
		const hasCustomerInfo = customerId || (guestName && guestSurname && guestPhone);
		if (!hasCustomerInfo) {
			return res.status(400).json({ message: 'Kayıtlı bir müşteri seçilmeli veya misafir bilgileri eksiksiz girilmelidir.' });
		}
		if (barber.role !== 'barber' && barber.role !== 'admin') {
			return res.status(403).json({ message: 'Bu işlemi yapmaya sadece berberler yetkilidir.' });

		}
		//const service = await barber.barberProfile.servicesOffered.findById(serviceId)
		if (!service) {
			return res.status(404).json({ message: 'Hizmet bulunamadı.' })
		}
		const appointmentEndTime = new Date(new Date(startTime).getTime() + service.duration * 60 * 1000);

		const appointmentData = {
			barber: barber.id,
			service: serviceId,
			startTime: new Date(startTime),
			endTime: appointmentEndTime
		};
		if (customerId) {
			appointmentData.customer = customerId
		}
		else if (guestName && guestSurname && guestPhone) {
			appointmentData.guestName = guestName;
			appointmentData.guestSurname = guestSurname;
			appointmentData.guestPhoneNumber = guestPhone;
		}
		else {
			return res.status(400).json({
				message: 'Kayıtlı bir müşteri seçilmeli veya misafir bilgileri girilmelidir.'
			})
		}


		//const appointmentStartTime = new Date(startTime);
		//const appointmentEndTime = new Date(appointmentStartTime.getTime() + service.duration * 60 * 1000);
		// Berberin kendi takviminde o saatte başka bir randevu var mı diye kontrol et.
		const existingAppointment = await Appointment.findOne({
			barber: barber.id, // Randevu, giriş yapmış berberin kendi takvimine yazılıyor.
			status: 'scheduled',
			$or: [
				{ startTime: { $lt: appointmentData.endTime, $gte: appointmentData.startTime } },
				{ endTime: { $gt: appointmentData.startTime, $lte: appointmentData.endTime } }
			]
		});
		if (existingAppointment) {
			return res.status(409).json({ message: 'Belirtilen saat dilimi zaten dolu veya başka bir randevu ile çakışıyor.' });
		}

		const newAppointment = new Appointment(appointmentData)
		await newAppointment.save();
		res.status(201).json({ message: 'Randevu berber tarafından başarıyla oluşturuldu.', appointment: newAppointment });

	} catch (error) {
		console.error("Berber tarafından randevu oluşturulurken hata:", error);
		res.status(500).json({ message: 'Randevu oluşturulurken bir sunucu hatası oluştu.' });

	}
}
module.exports = {
	getAvailableSlots,
	createAppointment,
	getMyBarberAppointments,
	cancelAppointment,
	createAppointmentByBarber
}