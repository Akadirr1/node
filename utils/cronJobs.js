// utils/cronJobs.js - For appointment reminders
const cron = require('node-cron');
const { sendAppointmentReminders } = require('../controllers/appointmentController');

// Schedule reminder SMS to be sent every day at 6 PM
const scheduleAppointmentReminders = () => {
    // Run every day at 18:00 (6 PM)
    cron.schedule('0 18 * * *', async () => {
        console.log('Running appointment reminder job...');
        try {
            await sendAppointmentReminders();
            console.log('Appointment reminder job completed successfully');
        } catch (error) {
            console.error('Appointment reminder job failed:', error);
        }
    }, {
        timezone: "Europe/Istanbul"
    });

    console.log('Appointment reminder job scheduled for 18:00 daily');
};

module.exports = { scheduleAppointmentReminders };