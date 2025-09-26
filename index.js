const express = require('express');
// Session removed - using JWT only
const rateLimit = require('express-rate-limit');
const expressSanitizer = require('express-sanitizer');
const helmet = require('helmet');
const cors = require('cors');
const otpRoutes = require('./routes/otpRoutes');
const { scheduleAppointmentReminders } = require('./utils/cronJobs');
const { errorHandler, notFound } = require('./middleWares/errorHandler');
const { validateEnvironment, getEnvInfo } = require('./utils/envValidation');
const { logger, requestLogger } = require('./utils/logger');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const userRoutes = require('./routes/userRoutes');
const barberRoutes = require('./routes/barberRoutes');
const appointmentRoutes= require('./routes/appointmentRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const port = process.env.PORT || 3002;
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Validate environment variables
validateEnvironment();

// Display environment info
console.log('=== ENVIRONMENT INFO ===');
const envInfo = getEnvInfo();
console.log('Node Environment:', envInfo.nodeEnv);
console.log('SMS Provider:', envInfo.smsProvider);
console.log('MongoDB URI:', envInfo.hasMongoUri ? 'Set ✓' : 'Missing ✗');
console.log('JWT Secret:', envInfo.hasJwtSecret ? 'Set ✓' : 'Missing ✗');
console.log('Session Secret:', envInfo.hasSessionSecret ? 'Set ✓' : 'Missing ✗');
console.log('Twilio Config:', envInfo.hasTwilioConfig ? 'Set ✓' : 'Missing ✗');
console.log('Netgsm Config:', envInfo.hasNetgsmConfig ? 'Set ✓' : 'Missing ✗');
console.log('Turktelekom Config:', envInfo.hasTurktelekomConfig ? 'Set ✓' : 'Missing ✗');
console.log('Test Mode:', envInfo.isTestMode ? 'Enabled ✓' : 'Disabled ✗');
console.log('========================');
// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy tarafından engellendi'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Request logging middleware
app.use(requestLogger);
if (process.env.NODE_ENV === 'production')
    {app.use(helmet({
    // Security middleware

    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));
}

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(expressSanitizer()) // Must be after express.json() and express.urlencoded()
// Session middleware removed - using JWT only
app.use(cookieParser()); // Add cookie parser middleware

// Rate limiting configurations
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Development'da daha yüksek limit
    message: 'Çok fazla istek gönderildi, lütfen 15 dakika sonra tekrar deneyin.',
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 50 : 5, // Development'da daha yüksek limit
    message: 'Çok fazla OTP isteği gönderildi, lütfen 15 dakika sonra tekrar deneyin.',
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 100 : 10, // Development'da daha yüksek limit
    message: 'Çok fazla giriş denemesi yapıldı, lütfen 15 dakika sonra tekrar deneyin.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting
app.use(generalLimiter);
app.use('/api/otp', otpLimiter);
app.use('/profile/login', loginLimiter);

app.use(express.static('public'))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

const User = require('./models/User')

mongoose.connect(process.env.MONGO_URI)
	.then(() => {
		logger.info("MongoDB bağlantısı başarılı");
		scheduleAppointmentReminders();
	})
	.catch((err) => {
		logger.error("MongoDB bağlantı hatası", err);
		process.exit(1);
	})

app.get('/', async(req, res) => {
	const pagetitle = "dinamik baslik";
	const kullanicilar = await User.find({});


	res.render('index', {
		title: pagetitle,
		users: kullanicilar
	});
})
app.get('/hakkimizda', (req, res) => {
	const pagetitle = "dinamik baslik";

	res.render('hakkimizda', {
		title: pagetitle
	});
})
app.get('/book', (req, res) => {
	const pagetitle = "dinamik baslik";

	res.render('book', {
		title: pagetitle
	});
})
app.get('/myAppointments', (req, res) => {
	const pagetitle = "dinamik baslik";

	res.render('appointments', {
		title: pagetitle
	});
})
app.get('/login', (req, res) => {
	const pagetitle = "dinamik baslik";

	res.render('login-with-otp', {
		title: pagetitle
	});
})
app.get('/register', (req, res) => {
	const pagetitle = "dinamik baslik";

	res.render('register-with-otp', {
		title: pagetitle
	});
})
app.get('/barber-dashboard',(req,res)=>{
	res.render('barber-dashboard',{
		title: "Yönetim Paneli"
	})
})
app.get('/otp-verification', (req, res) => {
    res.render('otp-verification', {
        title: "SMS Doğrulama"
    });
});

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        title: "Şifremi Unuttum"
    });
});
app.use('/api/otp', otpRoutes);
app.use('/api/services',serviceRoutes);
app.use('/profile', userRoutes);
app.use('/api/barbers',barberRoutes);
app.use('/api/appointments',appointmentRoutes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
	logger.info(`Server ${port} portunda çalışıyor`);
})