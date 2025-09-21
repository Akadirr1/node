const User = require('../models/User');
const OTP = require('../models/OTP');
const smsService = require('../services/smsService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Send OTP for registration
const sendRegistrationOTP = async (req, res) => {
    try {
        const { phoneNumber, name, surname } = req.body;

        if (!phoneNumber || !name || !surname) {
            return res.status(400).json({ 
                message: 'Telefon numarası, ad ve soyad gereklidir.' 
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ phoneNumber });
        if (existingUser) {
            return res.status(400).json({ 
                message: 'Bu telefon numarası ile zaten kayıtlı bir kullanıcı bulunmaktadır.' 
            });
        }

        // Generate OTP
        const otpCode = smsService.generateOTP();

        // Delete any existing OTP for this phone number and type
        await OTP.deleteMany({ phoneNumber, type: 'register' });

        // Save OTP to database
        const newOTP = new OTP({
            phoneNumber,
            otp: otpCode,
            type: 'register'
        });
        await newOTP.save();

        // Send SMS
        const smsResult = await smsService.sendOTP(phoneNumber, otpCode);
        
        if (smsResult.success) {
            // Store temporary user data in OTP record
            newOTP.tempUserData = { phoneNumber, name, surname };
            await newOTP.save();
            
            res.status(200).json({
                message: 'Doğrulama kodu gönderildi. Lütfen telefonunuzu kontrol edin.',
                phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') // Mask phone number
            });
        } else {
            await OTP.deleteOne({ _id: newOTP._id });
            res.status(500).json({ 
                message: 'SMS gönderimi başarısız. Lütfen daha sonra tekrar deneyin.' 
            });
        }

    } catch (error) {
        console.error('Registration OTP Error:', error);
        res.status(500).json({ 
            message: 'Sunucu hatası oluştu.' 
        });
    }
};

// Verify registration OTP and create user
const verifyRegistrationOTP = async (req, res) => {
    try {
        const { phoneNumber, otp, password } = req.body;

        if (!phoneNumber || !otp || !password) {
            return res.status(400).json({
                message: 'Telefon numarası, doğrulama kodu ve şifre gereklidir.'
            });
        }

        // Find OTP
        const otpRecord = await OTP.findOne({
            phoneNumber,
            type: 'register',
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.status(400).json({
                message: 'Geçersiz veya süresi dolmuş doğrulama kodu.'
            });
        }

        // Check attempts
        if (otpRecord.attempts >= 3) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({
                message: 'Çok fazla yanlış deneme. Yeni kod talep edin.'
            });
        }

        // Verify OTP
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            
            return res.status(400).json({
                message: `Yanlış doğrulama kodu. ${3 - otpRecord.attempts} hakkınız kaldı.`
            });
        }

        // Get user data from OTP record
        const tempUserData = otpRecord.tempUserData;
        if (!tempUserData || tempUserData.phoneNumber !== phoneNumber) {
            return res.status(400).json({
                message: 'Kayıt verisi bulunamadı. Lütfen tekrar kayıt olmayı deneyin.'
            });
        }

        // Create user
        const newUser = new User({
            name: tempUserData.name,
            surname: tempUserData.surname,
            phoneNumber,
            password,
            role: 'customer'
        });

        await newUser.save();

        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        // Clear temporary data from OTP record
        otpRecord.tempUserData = undefined;
        await otpRecord.save();

        // Send welcome SMS
        await smsService.sendWelcomeSMS(phoneNumber, tempUserData.name);

        // Generate JWT token
        const payload = {
            id: newUser._id,
            role: newUser.role,
            name: newUser.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000
        });

        res.status(201).json({
            message: 'Kayıt başarıyla tamamlandı.',
            user: {
                id: newUser._id,
                name: newUser.name,
                surname: newUser.surname,
                phoneNumber: newUser.phoneNumber,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error('OTP Verification Error:', error);
        res.status(500).json({
            message: 'Sunucu hatası oluştu.'
        });
    }
};

// Send login OTP
const sendLoginOTP = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                message: 'Telefon numarası gereklidir.'
            });
        }

        // Check if user exists
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({
                message: 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı.'
            });
        }

        // Generate OTP
        const otpCode = smsService.generateOTP();

        // Delete existing OTP
        await OTP.deleteMany({ phoneNumber, type: 'login' });

        // Save new OTP
        const newOTP = new OTP({
            phoneNumber,
            otp: otpCode,
            type: 'login'
        });
        await newOTP.save();

        // Send SMS
        const smsResult = await smsService.sendOTP(phoneNumber, otpCode);

        if (smsResult.success) {
            res.status(200).json({
                message: 'Giriş doğrulama kodu gönderildi.',
                phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
            });
        } else {
            await OTP.deleteOne({ _id: newOTP._id });
            res.status(500).json({
                message: 'SMS gönderimi başarısız.'
            });
        }

    } catch (error) {
        console.error('Login OTP Error:', error);
        res.status(500).json({
            message: 'Sunucu hatası oluştu.'
        });
    }
};

// Verify login OTP
const verifyLoginOTP = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({
                message: 'Telefon numarası ve doğrulama kodu gereklidir.'
            });
        }

        // Find OTP
        const otpRecord = await OTP.findOne({
            phoneNumber,
            type: 'login',
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.status(400).json({
                message: 'Geçersiz veya süresi dolmuş doğrulama kodu.'
            });
        }

        // Check attempts
        if (otpRecord.attempts >= 3) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({
                message: 'Çok fazla yanlış deneme. Yeni kod talep edin.'
            });
        }

        // Verify OTP
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            
            return res.status(400).json({
                message: `Yanlış doğrulama kodu. ${3 - otpRecord.attempts} hakkınız kaldı.`
            });
        }

        // Find user
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({
                message: 'Kullanıcı bulunamadı.'
            });
        }

        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        // Generate JWT token
        const payload = {
            id: user._id,
            role: user.role,
            name: user.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000
        });

        res.status(200).json({
            message: 'Giriş başarılı.',
            user: {
                id: user._id,
                name: user.name,
                surname: user.surname,
                phoneNumber: user.phoneNumber,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login OTP Verification Error:', error);
        res.status(500).json({
            message: 'Sunucu hatası oluştu.'
        });
    }
};

// Send password reset OTP
const sendPasswordResetOTP = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                message: 'Telefon numarası gereklidir.'
            });
        }

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({
                message: 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı.'
            });
        }

        const resetCode = smsService.generateOTP();

        await OTP.deleteMany({ phoneNumber, type: 'password_reset' });

        const newOTP = new OTP({
            phoneNumber,
            otp: resetCode,
            type: 'password_reset'
        });
        await newOTP.save();

        const smsResult = await smsService.sendPasswordResetSMS(phoneNumber, resetCode);

        if (smsResult.success) {
            res.status(200).json({
                message: 'Şifre sıfırlama kodu gönderildi.',
                phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
            });
        } else {
            await OTP.deleteOne({ _id: newOTP._id });
            res.status(500).json({
                message: 'SMS gönderimi başarısız.'
            });
        }

    } catch (error) {
        console.error('Password Reset OTP Error:', error);
        res.status(500).json({
            message: 'Sunucu hatası oluştu.'
        });
    }
};

// Verify password reset and update password
const verifyPasswordResetOTP = async (req, res) => {
    try {
        const { phoneNumber, otp, newPassword } = req.body;

        if (!phoneNumber || !otp || !newPassword) {
            return res.status(400).json({
                message: 'Telefon numarası, doğrulama kodu ve yeni şifre gereklidir.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: 'Şifre en az 6 karakter olmalıdır.'
            });
        }

        const otpRecord = await OTP.findOne({
            phoneNumber,
            type: 'password_reset',
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.status(400).json({
                message: 'Geçersiz veya süresi dolmuş doğrulama kodu.'
            });
        }

        if (otpRecord.attempts >= 3) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({
                message: 'Çok fazla yanlış deneme. Yeni kod talep edin.'
            });
        }

        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            
            return res.status(400).json({
                message: `Yanlış doğrulama kodu. ${3 - otpRecord.attempts} hakkınız kaldı.`
            });
        }

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({
                message: 'Kullanıcı bulunamadı.'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        res.status(200).json({
            message: 'Şifreniz başarıyla güncellendi.'
        });

    } catch (error) {
        console.error('Password Reset Verification Error:', error);
        res.status(500).json({
            message: 'Sunucu hatası oluştu.'
        });
    }
};

module.exports = {
    sendRegistrationOTP,
    verifyRegistrationOTP,
    sendLoginOTP,
    verifyLoginOTP,
    sendPasswordResetOTP,
    verifyPasswordResetOTP
};