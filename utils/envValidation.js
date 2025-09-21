const requiredEnvVars = [
    'MONGO_URI',
    'JWT_SECRET'
];

const optionalEnvVars = [
    'NODE_ENV',
    'SMS_PROVIDER',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_FROM_NUMBER',
    'TURKTELEKOM_USERNAME',
    'TURKTELEKOM_PASSWORD',
    'TURKTELEKOM_ORIGINATOR',
    'NETGSM_USER_CODE',
    'NETGSM_PASSWORD',
    'NETGSM_MSG_HEADER',
    'SMS_TEST_MODE',
    'SMS_TEST_NUMBERS',
    'FRONTEND_URL',
    'SESSION_SECRET'
];

const validateEnvironment = () => {
    const missing = [];
    const warnings = [];

    // Check required environment variables
    requiredEnvVars.forEach(envVar => {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    });

    // Check optional but recommended environment variables
    if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'development';
        warnings.push('NODE_ENV not set, defaulting to development');
    }

    if (!process.env.SMS_PROVIDER) {
        process.env.SMS_PROVIDER = 'twilio';
        warnings.push('SMS_PROVIDER not set, defaulting to twilio');
    }

    // Validate JWT_SECRET strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        warnings.push('JWT_SECRET should be at least 32 characters long for security');
    }

    // SESSION_SECRET is now optional (JWT-only system)

    // Validate MongoDB URI format
    if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb://') && !process.env.MONGO_URI.startsWith('mongodb+srv://')) {
        warnings.push('MONGO_URI should start with mongodb:// or mongodb+srv://');
    }

    // Validate SMS configuration
    if (process.env.SMS_PROVIDER === 'twilio') {
        const twilioRequired = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
        twilioRequired.forEach(envVar => {
            if (!process.env[envVar]) {
                warnings.push(`${envVar} is required when SMS_PROVIDER is twilio`);
            }
        });
    }

    if (process.env.SMS_PROVIDER === 'netgsm') {
        const netgsmRequired = ['NETGSM_USER_CODE', 'NETGSM_PASSWORD'];
        netgsmRequired.forEach(envVar => {
            if (!process.env[envVar]) {
                warnings.push(`${envVar} is required when SMS_PROVIDER is netgsm`);
            }
        });
    }

    if (process.env.SMS_PROVIDER === 'turktelekom') {
        const turktelekomRequired = ['TURKTELEKOM_USERNAME', 'TURKTELEKOM_PASSWORD'];
        turktelekomRequired.forEach(envVar => {
            if (!process.env[envVar]) {
                warnings.push(`${envVar} is required when SMS_PROVIDER is turktelekom`);
            }
        });
    }

    // Log warnings
    if (warnings.length > 0) {
        console.warn('⚠️  Environment Configuration Warnings:');
        warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    // Handle missing required variables
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(envVar => console.error(`   - ${envVar}`));
        console.error('\nPlease set these environment variables and restart the application.');
        process.exit(1);
    }

    console.log('✅ Environment validation passed');
};

const getEnvInfo = () => {
    const info = {
        nodeEnv: process.env.NODE_ENV,
        smsProvider: process.env.SMS_PROVIDER,
        hasMongoUri: !!process.env.MONGO_URI,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasSessionSecret: !!process.env.SESSION_SECRET, // Optional now
        hasTwilioConfig: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        hasNetgsmConfig: !!(process.env.NETGSM_USER_CODE && process.env.NETGSM_PASSWORD),
        hasTurktelekomConfig: !!(process.env.TURKTELEKOM_USERNAME && process.env.TURKTELEKOM_PASSWORD),
        isTestMode: process.env.SMS_TEST_MODE === 'true'
    };
    
    return info;
};

module.exports = {
    validateEnvironment,
    getEnvInfo,
    requiredEnvVars,
    optionalEnvVars
};
