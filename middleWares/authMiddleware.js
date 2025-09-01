const jwt = require('jsonwebtoken');
const User = require('../models/User');
const cookieParser = require('cookie-parser')

const protect = async (req, res, next) => {
	let token;

	if (req.cookies && req.cookies.token) {
		try {
			token = req.cookies.token;
			const decoded = jwt.verify(token, process.env.JWT_SECRET);

			req.user = await User.findById(decoded.id).select('-password');

			next();
		} catch (error) {
			console.error(error);
			res.status(401).json({ message: 'Yetkiniz yok, token geçersiz.' });
		}
	}
	if (!token) {
		res.status(401).json({ message: 'Yetkiniz yok, token bulunamadı.' });
	}
}
const adminOnly = (req, res, next) => {
    // 'protect' middleware'i daha önce çalışıp 'req.user' objesini doldurduğu için
    // burada req.user'ın var olduğunu ve dolu olduğunu varsayabiliriz.
    if (req.user && req.user.role === 'admin') {
        // Eğer kullanıcı admin ise, bir sonraki adıma geçmesine izin ver.
        next();
    } else {
        // Eğer admin değilse, 403 Forbidden (Yasak) hatası döndür.
        res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok. Sadece adminler erişebilir.' });
    }
};
module.exports = {protect,adminOnly};