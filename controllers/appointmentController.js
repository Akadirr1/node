const User = require('../models/User');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');
const { set } = require('../models/BarberProfile');
const Service = require('../models/Service');
const getAvailableSlots = async (req, res) => {
	try {
		const { date, serviceId } = req.query;
		const { barberId } = req.params;
		const slotIncrement = 30; // Randevuların hangi sıklıkla gösterileceği (15, 30 dk vb.)

		if (!date || !serviceId) {
			return res.status(400).json({ message: 'Lütfen bir tarih ve hizmet seçin.' });
		}

		// 1. Gerekli Bilgileri Veritabanından Al
		const barber = await User.findById(barberId).populate('barberProfile.servicesOffered.service');
		if (!barber || barber.role !== 'barber' || !barber.barberProfile) {
			return res.status(404).json({ message: 'Berber bulunamadı.' });
		}

		const service = barber.barberProfile.servicesOffered.find(
			s => s.service._id.toString() === serviceId && s.isActive
		);
		if (!service) {
			return res.status(404).json({ message: 'Seçilen hizmet bu berber tarafından sunulmuyor veya aktif değil.' });
		}
		const serviceDuration = service.duration;

		// 2. Berberin O Günki Çalışma Saatlerini Belirle (UTC Olarak)
		const selectedDate = new Date(date); // Gelen tarihi 'YYYY-MM-DD' olarak varsayıyoruz
		const dayOfWeek = selectedDate.getUTCDay();

		const schedule = barber.barberProfile.standardAvailability.find(d => d.dayOfWeek === dayOfWeek);
		if (!schedule) {
			return res.json([]); // O gün berber çalışmıyorsa boş dizi döndür.
		}

		const [startH, startM] = schedule.startTime.split(':').map(Number);
		const workStartTime = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate(), startH, startM));

		const [endH, endM] = schedule.endTime.split(':').map(Number);
		const workEndTime = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate(), endH, endM));

		// 3. O Günki Tüm Meşgul Zaman Aralıklarını Verimli Bir Şekilde Çek
		const startOfDay = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate(), 0, 0, 0));
		const endOfDay = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate(), 23, 59, 59));

		const appointmentsOnDay = await Appointment.find({
			barber: barberId,
			status: { $in: ['scheduled', 'completed'] }, // Sadece planlanmış ve tamamlanmış randevular meşguliyet yaratır
			startTime: { $gte: startOfDay, $lt: endOfDay }
		});

		// Meşguliyetleri ve izinleri tek bir listede topla
		const busySlots = [
			...appointmentsOnDay.map(appt => ({ start: appt.startTime, end: appt.endTime })),
			...barber.barberProfile.timeOffs
				.filter(off => off.startTime < endOfDay && off.endTime > startOfDay) // Sadece ilgili günü kesen izinleri al
				.map(off => ({ start: off.startTime, end: off.endTime }))
		];

		// 4. Potansiyel Saatleri Oluştur ve Uygun Olanları Filtrele
		const availableSlots = [];
		let potentialSlotTime = new Date(workStartTime);

		while (potentialSlotTime < workEndTime) {
			const potentialEndTime = new Date(potentialSlotTime.getTime() + serviceDuration * 60 * 1000);

			// Eğer potansiyel bitiş saati, mesai bitişini aşıyorsa bu saati atla
			if (potentialEndTime > workEndTime) {
				break;
			}

			// Potansiyel saatin meşgul bir aralıkla çakışıp çakışmadığını kontrol et
			const isOverlapping = busySlots.some(busySlot =>
				(potentialSlotTime < busySlot.end && potentialEndTime > busySlot.start)
			);

			if (!isOverlapping) {
				availableSlots.push(new Date(potentialSlotTime));
			}

			// Bir sonraki potansiyel saate geç
			potentialSlotTime.setTime(potentialSlotTime.getTime() + slotIncrement * 60 * 1000);
		}

		res.status(200).json(availableSlots);

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
		const barber = await User.findById(barberId); // barberProfile.timeOffs erişimi için
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

		// Timeoff çakışmasını da engelle
		const hasTimeOffOverlap = (barber.barberProfile?.timeOffs || []).some(off => {
			const offStart = new Date(off.startTime);
			const offEnd = new Date(off.endTime);
			return appointmentStartTime < offEnd && appointmentEndTime > offStart;
		});
		if (hasTimeOffOverlap) {
			return res.status(409).json({ message: 'Bu saat aralığı berberin izin saatlerine denk geliyor.' });
		}

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

		// 2 gün öncesinden itibaren randevuları getir
		const twoDaysAgo = new Date();
		twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
		twoDaysAgo.setHours(0, 0, 0, 0); // Günün başına ayarla

		const appointment = await Appointment.find({
			barber: barberId,
			status: 'scheduled',
			startTime: { $gte: twoDaysAgo }
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
		const appointmentStartTime = new Date(startTime);
		const appointmentEndTime = new Date(appointmentStartTime.getTime() + service.duration * 60 * 1000);

		// Timeoff çakışması
		const hasTimeOffOverlap = (barber.barberProfile?.timeOffs || []).some(off => {
			const offStart = new Date(off.startTime);
			const offEnd = new Date(off.endTime);
			return appointmentStartTime < offEnd && appointmentEndTime > offStart;
		});
		if (hasTimeOffOverlap) {
			return res.status(409).json({ message: 'Bu saat aralığı berberin izin saatlerine denk geliyor.' });
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