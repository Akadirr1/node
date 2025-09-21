// services/smsService.js
const axios = require('axios');
const crypto = require('crypto');

class SMSService {
    constructor() {
        // Constructor'da env değişkenlerini okuma - lazy loading yap
        this.provider = null;
        this.twilio = null;
        this.netgsm = null;
        this.turktelekom = null;
    }

    // İlk kullanımda env değişkenlerini yükle
    initializeConfig() {
        if (this.provider !== null) return; // Zaten yüklenmiş

        this.provider = process.env.SMS_PROVIDER || 'twilio';
        
        console.log('SMS Provider:', this.provider);
        console.log('Twilio SID:', process.env.TWILIO_ACCOUNT_SID ? 'Set ✓' : 'Missing ✗');
        console.log('Twilio Token:', process.env.TWILIO_AUTH_TOKEN ? 'Set ✓' : 'Missing ✗');
        console.log('Twilio Number:', process.env.TWILIO_FROM_NUMBER);

        this.twilio = {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            fromNumber: process.env.TWILIO_FROM_NUMBER
        };
        
        this.turktelekom = {
            username: process.env.TURKTELEKOM_USERNAME,
            password: process.env.TURKTELEKOM_PASSWORD,
            originator: process.env.TURKTELEKOM_ORIGINATOR || 'BERBER'
        };
        
        this.netgsm = {
            userCode: process.env.NETGSM_USER_CODE,
            password: process.env.NETGSM_PASSWORD,
            msgHeader: process.env.NETGSM_MSG_HEADER || 'BERBER'
        };

        // Test/simulation mode kontrolü
        this.isTestMode = process.env.SMS_TEST_MODE === 'true';
        this.testNumbers = (process.env.SMS_TEST_NUMBERS || '').split(',').filter(n => n.trim());
    }

    // Generate OTP code
    generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * 10)];
        }
        return otp;
    }

    // Format phone number to international format
    formatPhoneNumber(phoneNumber) {
        // Remove all non-numeric characters
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        // If already starts with +, return as is
        if (phoneNumber.startsWith('+')) {
            return phoneNumber;
        }
        
        // US number formatting (10 digits)
        if (cleaned.length === 10 && !cleaned.startsWith('0') && !cleaned.startsWith('90')) {
            return '+1' + cleaned; // US country code
        }
        
        // US number with country code (11 digits starting with 1)
        if (cleaned.startsWith('1') && cleaned.length === 11) {
            return '+' + cleaned;
        }
        
        // Turkish number formatting
        // If starts with 0, replace with +90 (Turkey country code)
        if (cleaned.startsWith('0') && cleaned.length === 11) {
            return '+90' + cleaned.substring(1);
        }
        
        // If starts with 90, add +
        if (cleaned.startsWith('90') && cleaned.length === 12) {
            return '+' + cleaned;
        }
        
        // If already has +90
        if (cleaned.startsWith('90') && phoneNumber.startsWith('+')) {
            return phoneNumber;
        }
        
        // Default: if length suggests US number (10 digits), format as US
        if (cleaned.length === 10) {
            return '+1' + cleaned;
        }
        
        // Default: assume it's Turkish number without country code
        return '+90' + cleaned;
    }

    // Send SMS using Twilio
    async sendViaTwilio(to, message) {
        this.initializeConfig(); // Config'i yükle
        
        try {
            const accountSid = this.twilio.accountSid;
            const authToken = this.twilio.authToken;
            const fromNumber = this.twilio.fromNumber;

            if (!accountSid || !authToken || !fromNumber) {
                throw new Error('Twilio credentials are missing');
            }

            console.log(`🚀 Sending SMS via Twilio to: ${to}`);

            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                new URLSearchParams({
                    To: to,
                    From: fromNumber,
                    Body: message
                }),
                {
                    auth: {
                        username: accountSid,
                        password: authToken
                    },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return { success: true, messageId: response.data.sid };
        } catch (error) {
            console.error('Twilio SMS Error:', error.response?.data || error.message);
            return { success: false, error: error.response?.data || error.message };
        }
    }

    // Send SMS using Netgsm (Turkey)
    async sendViaNetgsm(to, message) {
        this.initializeConfig(); // Config'i yükle
        
        try {
            const cleanPhone = to.replace('+90', '').replace('+', '');
            
            console.log(`🚀 Sending SMS via Netgsm to: ${cleanPhone}`);

            const response = await axios.get('https://api.netgsm.com.tr/sms/send/get', {
                params: {
                    usercode: this.netgsm.userCode,
                    password: this.netgsm.password,
                    gsmno: cleanPhone,
                    message: message,
                    msgheader: this.netgsm.msgHeader
                }
            });

            const result = response.data.toString();
            if (result.startsWith('00')) {
                return { success: true, messageId: result };
            } else {
                return { success: false, error: `Netgsm Error Code: ${result}` };
            }
        } catch (error) {
            console.error('Netgsm SMS Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Send SMS using Türk Telekom
    async sendViaTurkTelekom(to, message) {
        this.initializeConfig(); // Config'i yükle
        
        try {
            const cleanPhone = to.replace('+90', '').replace('+', '');
            
            console.log(`🚀 Sending SMS via Türk Telekom to: ${cleanPhone}`);
            
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
                <sms>
                    <authentication>
                        <username>${this.turktelekom.username}</username>
                        <password>${this.turktelekom.password}</password>
                    </authentication>
                    <message>
                        <originator>${this.turktelekom.originator}</originator>
                        <text>${message}</text>
                    </message>
                    <recipients>
                        <gsm>${cleanPhone}</gsm>
                    </recipients>
                </sms>`;

            const response = await axios.post(
                'https://api.turktelekom.com.tr/ttbulksms/v1/api',
                xmlData,
                {
                    headers: {
                        'Content-Type': 'application/xml'
                    }
                }
            );

            return { success: true, messageId: response.data };
        } catch (error) {
            console.error('Türk Telekom SMS Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Main SMS sending method
    async sendSMS(phoneNumber, message) {
        this.initializeConfig(); // Config'i yükle
        
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        
        console.log(`📱 Formatting ${phoneNumber} → ${formattedNumber}`);
        
        // Test mode kontrolü
        if (this.isTestMode) {
            console.log(`🧪 TEST MODE: SMS would be sent to ${formattedNumber}`);
            console.log(`📧 Message: ${message}`);
            
            // Test numaraları kontrol et
            if (this.testNumbers.length > 0 && !this.testNumbers.includes(formattedNumber)) {
                console.log(`⚠️ Number ${formattedNumber} not in test numbers list`);
                return { success: false, error: 'Number not allowed in test mode' };
            }
            
            // Test mode'da başarılı simülasyonu
            const testMessageId = 'TEST_' + Date.now();
            console.log(`✅ SMS simulated successfully to ${formattedNumber}: ${testMessageId}`);
            return { success: true, messageId: testMessageId, isTest: true };
        }
        
        try {
            let result;
            
            switch (this.provider) {
                case 'twilio':
                    result = await this.sendViaTwilio(formattedNumber, message);
                    break;
                case 'netgsm':
                    result = await this.sendViaNetgsm(formattedNumber, message);
                    break;
                case 'turktelekom':
                    result = await this.sendViaTurkTelekom(formattedNumber, message);
                    break;
                default:
                    throw new Error('SMS provider not configured');
            }

            if (result.success) {
                console.log(`✅ SMS sent successfully to ${formattedNumber}: ${result.messageId}`);
                return result;
            } else {
                console.error(`❌ SMS failed to ${formattedNumber}:`, result.error);
                return result;
            }
        } catch (error) {
            console.error('SMS Service Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Send OTP SMS
    async sendOTP(phoneNumber, otp) {
        const message = `Berber randevu sistemi doğrulama kodunuz: ${otp}. Bu kodu kimseyle paylaşmayın.`;
        return await this.sendSMS(phoneNumber, message);
    }

    // Send welcome SMS
    async sendWelcomeSMS(phoneNumber, name) {
        const message = `Merhaba ${name}! Berber randevu sistemimize hoş geldiniz. Artık kolayca randevu alabilirsiniz.`;
        return await this.sendSMS(phoneNumber, message);
    }

    // Send appointment confirmation
    async sendAppointmentConfirmation(phoneNumber, appointmentDetails) {
        const { customerName, barberName, serviceName, date, time } = appointmentDetails;
        const message = `Merhaba ${customerName}, ${date} tarihinde saat ${time}'da ${barberName} ile ${serviceName} randevunuz oluşturuldu. İyi günler!`;
        return await this.sendSMS(phoneNumber, message);
    }

    // Send appointment reminder
    async sendAppointmentReminder(phoneNumber, appointmentDetails) {
        const { customerName, barberName, serviceName, date, time } = appointmentDetails;
        const message = `Hatırlatma: ${customerName}, yarın saat ${time}'da ${barberName} ile ${serviceName} randevunuz bulunmaktadır. İyi günler!`;
        return await this.sendSMS(phoneNumber, message);
    }

    // Send appointment cancellation
    async sendAppointmentCancellation(phoneNumber, appointmentDetails) {
        const { customerName, barberName, date, time } = appointmentDetails;
        const message = `Merhaba ${customerName}, ${date} tarihinde saat ${time}'daki ${barberName} ile olan randevunuz iptal edilmiştir.`;
        return await this.sendSMS(phoneNumber, message);
    }

    // Send password reset SMS
    async sendPasswordResetSMS(phoneNumber, resetCode) {
        const message = `Şifre sıfırlama kodunuz: ${resetCode}. Bu kodu kimseyle paylaşmayın. 10 dakika içinde geçerlidir.`;
        return await this.sendSMS(phoneNumber, message);
    }
}

module.exports = new SMSService();