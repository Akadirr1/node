const User = require('../models/User');
const Appointment = require('../models/Appointment');
const smsService = require('../services/smsService');
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

        const barber = await User.findById(barberId).populate('barberProfile.servicesOffered.service');
        if (!barber || barber.role !== 'barber' || !barber.barberProfile) {
            return res.status(404).json({ message: 'Geçerli bir berber bulunamadı.' });
        }

        const customer = await User.findById(customerId);
        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı.' });
        }

        const offeredService = barber.barberProfile.servicesOffered.find(
            s => s.service._id.toString() === serviceId
        );
        if (!offeredService) {
            return res.status(404).json({ message: 'Hizmet bulunamadı.' });
        }

        const serviceDuration = offeredService.duration;
        const appointmentStartTime = new Date(startTime);
        const appointmentEndTime = new Date(appointmentStartTime.getTime() + serviceDuration * 60 * 1000);

        // Check for timeoff overlap
        const hasTimeOffOverlap = (barber.barberProfile?.timeOffs || []).some(off => {
            const offStart = new Date(off.startTime);
            const offEnd = new Date(off.endTime);
            return appointmentStartTime < offEnd && appointmentEndTime > offStart;
        });

        if (hasTimeOffOverlap) {
            return res.status(409).json({ message: 'Bu saat aralığı berberin izin saatlerine denk geliyor.' });
        }

        // Check for existing appointments
        const existingAppointment = await Appointment.findOne({
            barber: barberId,
            status: { $in: ['scheduled', 'completed'] },
            $or: [
                { startTime: { $lt: appointmentEndTime, $gte: appointmentStartTime } },
                { endTime: { $gt: appointmentStartTime, $lte: appointmentEndTime } }
            ]
        });

        if (existingAppointment) {
            return res.status(409).json({ message: 'Üzgünüz, bu saat dilimi az önce başkası tarafından alındı.' });
        }

        // Create appointment
        const newAppointment = new Appointment({
            customer: customerId,
            barber: barberId,
            service: serviceId,
            startTime: appointmentStartTime,
            endTime: appointmentEndTime,
        });

        await newAppointment.save();

        // Send SMS confirmation to customer
        const appointmentDate = appointmentStartTime.toLocaleDateString('tr-TR');
        const appointmentTime = appointmentStartTime.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const appointmentDetails = {
            customerName: `${customer.name} ${customer.surname}`,
            barberName: `${barber.name} ${barber.surname}`,
            serviceName: offeredService.service.name,
            date: appointmentDate,
            time: appointmentTime
        };

        // Send confirmation SMS to customer
        try {
            await smsService.sendAppointmentConfirmation(customer.phoneNumber, appointmentDetails);
        } catch (smsError) {
            console.error('SMS gönderimi başarısız:', smsError);
            // Don't fail the appointment creation if SMS fails
        }

        res.status(201).json({ 
            message: 'Randevunuz başarıyla oluşturuldu. SMS onayı gönderildi.', 
            appointment: newAppointment 
        });

    } catch (error) {
        console.error("Randevu oluşturulurken hata:", error);
        res.status(500).json({ message: 'Randevu oluşturulurken bir sunucu hatası oluştu.' });
    }
};
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
        
        const appointment = await Appointment.findById(appointmentId)
            .populate('customer', 'name surname phoneNumber')
            .populate('barber', 'name surname phoneNumber')
            .populate('service', 'name');

        if (!appointment) {
            return res.status(404).json({ message: 'İptal edilecek randevu bulunamadı.' });
        }

        const isCustomer = user.id == appointment.customer._id;
        const isBarber = user.id == appointment.barber._id;

        if (!isCustomer && !isBarber && user.role !== 'admin') {
            return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
        }

        if (appointment.status === "completed" || appointment.status === "cancelled_by_user" || appointment.status === "cancelled_by_barber") {
            return res.status(400).json({ message: 'Bu randevu zaten tamamlanmış veya iptal edilmiş.' });
        }

        // Update appointment status
        appointment.status = user.role === 'customer' ? 'cancelled_by_user' : 'cancelled_by_barber';
        await appointment.save();

        // Prepare SMS details
        const appointmentDate = appointment.startTime.toLocaleDateString('tr-TR');
        const appointmentTime = appointment.startTime.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const appointmentDetails = {
            customerName: `${appointment.customer.name} ${appointment.customer.surname}`,
            barberName: `${appointment.barber.name} ${appointment.barber.surname}`,
            date: appointmentDate,
            time: appointmentTime
        };

        // Send cancellation SMS to both customer and barber
        try {
            if (isCustomer) {
                // Customer cancelled - notify barber
                await smsService.sendAppointmentCancellation(appointment.barber.phoneNumber, appointmentDetails);
				await smsService.sendAppointmentCancellation(appointment.customer.phoneNumber, appointmentDetails);

            } else {
                // Barber cancelled - notify customer
                await smsService.sendAppointmentCancellation(appointment.customer.phoneNumber, appointmentDetails);
            }
        } catch (smsError) {
            console.error('İptal SMS gönderimi başarısız:', smsError);
        }

        res.status(200).json({ 
            message: 'Randevu başarıyla iptal edildi. İlgili taraf SMS ile bilgilendirildi.', 
            appointment 
        });

    } catch (error) {
        console.error("Randevu iptal edilirken hata:", error);
        res.status(500).json({ message: 'Randevu iptal edilirken bir sunucu hatası oluştu.' });
    }
};
const createAppointmentByBarber = async (req, res) => {
    try {
        const barber = req.user;
        const { 
            customerId, 
            guestName, 
            guestSurname, 
            guestPhone, 
            serviceId, 
            startTime 
        } = req.body;

        if (!serviceId || !startTime) {
            return res.status(400).json({ message: 'Hizmet ve başlangıç saati zorunludur.' });
        }

        if (barber.role !== 'barber' && barber.role !== 'admin') {
            return res.status(403).json({ message: 'Bu işlemi yapmaya sadece berberler yetkilidir.' });
        }

        // Populate barber profile
        await barber.populate('barberProfile.servicesOffered.service');

        const service = barber.barberProfile.servicesOffered.find(
            s => s.service._id.toString() === serviceId && s.isActive
        );

        if (!service) {
            return res.status(404).json({ message: 'Hizmet bulunamadı veya aktif değil.' });
        }

        const hasCustomerInfo = customerId || (guestName && guestSurname && guestPhone);
        if (!hasCustomerInfo) {
            return res.status(400).json({ 
                message: 'Kayıtlı bir müşteri seçilmeli veya misafir bilgileri eksiksiz girilmelidir.' 
            });
        }

        const appointmentStartTime = new Date(startTime);
        const appointmentEndTime = new Date(appointmentStartTime.getTime() + service.duration * 60 * 1000);

        // Check timeoff overlap
        const hasTimeOffOverlap = (barber.barberProfile?.timeOffs || []).some(off => {
            const offStart = new Date(off.startTime);
            const offEnd = new Date(off.endTime);
            return appointmentStartTime < offEnd && appointmentEndTime > offStart;
        });

        if (hasTimeOffOverlap) {
            return res.status(409).json({ message: 'Bu saat aralığı berberin izin saatlerine denk geliyor.' });
        }

        // Check for existing appointments
        const existingAppointment = await Appointment.findOne({
            barber: barber.id,
            status: { $in: ['scheduled'] },
            $or: [
                { startTime: { $lt: appointmentEndTime, $gte: appointmentStartTime } },
                { endTime: { $gt: appointmentStartTime, $lte: appointmentEndTime } }
            ]
        });

        if (existingAppointment) {
            return res.status(409).json({ 
                message: 'Belirtilen saat dilimi zaten dolu veya başka bir randevu ile çakışıyor.' 
            });
        }

        // Prepare appointment data
        const appointmentData = {
            barber: barber.id,
            service: serviceId,
            startTime: appointmentStartTime,
            endTime: appointmentEndTime,
        };

        // Add customer or guest information
        if (customerId) {
            const customer = await User.findById(customerId);
            if (!customer) {
                return res.status(404).json({ message: 'Müşteri bulunamadı.' });
            }
            appointmentData.customer = customerId;
        } else {
            appointmentData.guestName = guestName;
            appointmentData.guestSurname = guestSurname;
            appointmentData.guestPhoneNumber = guestPhone;
        }

        const newAppointment = new Appointment(appointmentData);
        await newAppointment.save();

        // Send SMS confirmation
        const appointmentDate = appointmentStartTime.toLocaleDateString('tr-TR');
        const appointmentTime = appointmentStartTime.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const appointmentDetails = {
            customerName: customerId ? 
                `${(await User.findById(customerId)).name} ${(await User.findById(customerId)).surname}` :
                `${guestName} ${guestSurname}`,
            barberName: `${barber.name} ${barber.surname}`,
            serviceName: service.service.name,
            date: appointmentDate,
            time: appointmentTime
        };

        const phoneNumber = customerId ? 
            (await User.findById(customerId)).phoneNumber : 
            guestPhone;

        try {
            await smsService.sendAppointmentConfirmation(phoneNumber, appointmentDetails);
        } catch (smsError) {
            console.error('SMS gönderimi başarısız:', smsError);
        }

        res.status(201).json({ 
            message: 'Randevu berber tarafından başarıyla oluşturuldu. SMS onayı gönderildi.', 
            appointment: newAppointment 
        });

    } catch (error) {
        console.error("Berber tarafından randevu oluşturulurken hata:", error);
        res.status(500).json({ message: 'Randevu oluşturulurken bir sunucu hatası oluştu.' });
    }
};
const sendAppointmentReminders = async () => {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        // Find appointments for tomorrow
        const tomorrowAppointments = await Appointment.find({
            status: 'scheduled',
            startTime: {
                $gte: tomorrow,
                $lt: dayAfterTomorrow
            }
        })
        .populate('customer', 'name surname phoneNumber')
        .populate('barber', 'name surname')
        .populate('service', 'name');

        for (const appointment of tomorrowAppointments) {
            const appointmentTime = appointment.startTime.toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            const appointmentDetails = {
                customerName: appointment.customer ? 
                    `${appointment.customer.name} ${appointment.customer.surname}` :
                    `${appointment.guestName} ${appointment.guestSurname}`,
                barberName: `${appointment.barber.name} ${appointment.barber.surname}`,
                serviceName: appointment.service.name,
                date: appointment.startTime.toLocaleDateString('tr-TR'),
                time: appointmentTime
            };

            const phoneNumber = appointment.customer ? 
                appointment.customer.phoneNumber : 
                appointment.guestPhoneNumber;

            try {
                await smsService.sendAppointmentReminder(phoneNumber, appointmentDetails);
                console.log(`Reminder sent for appointment ${appointment._id}`);
            } catch (smsError) {
                console.error(`Failed to send reminder for appointment ${appointment._id}:`, smsError);
            }
        }

        console.log(`Processed ${tomorrowAppointments.length} appointment reminders`);
        
    } catch (error) {
        console.error('Error sending appointment reminders:', error);
    }
};
const updateAppointmentStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body;
		const user = req.user;

		const allowedStatusUpdates = ['completed', 'no_show'];
		if (!allowedStatusUpdates) {
			return res.status(400).json({ message: 'Geçersiz durum güncellemesi.' })
		}

		const appointment = await Appointment.findById(id);

		if (!appointment) {
			return res.status(400).json({ message: 'randevu bulunamadı' })
		}
		if (appointment.barber.toString() !== user.id) {
			return res.status(403).json({ message: 'Bu islemi yapma yetkiniz yok!' })
		}
		if (appointment.status !== 'scheduled') {
			return res.status(400).json({ message: `bu randevunun durumu ${appointment.status} olarak ayarlanmış` })
		}

		appointment.status= status;
		await appointment.save();

		res.status(200).json({message:`Randevu durumu başarı ile ${appointment.status} olarak güncellendi.`})
	} catch (error) {
		console.error("Randevu durumu güncellenirken hata:", error);
		res.status(500).json({ message: 'Randevu durumu güncellenirken bir sunucu hatası oluştu.' });

	}
}
module.exports = {
	getAvailableSlots,
	createAppointment,
	getMyBarberAppointments,
	cancelAppointment,
	createAppointmentByBarber,
	updateAppointmentStatus,
	sendAppointmentReminders
}