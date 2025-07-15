const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const userRoutes = require('./routes/userRoutes');
const barberRoutes = require('./routes/barberRoutes');
const appointmentRoutes= require('./routes/appointmentRoutes');
const port = 3000;
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
app.use(express.json())
app.use(cookieParser()); // Add cookie parser middleware
app.use(express.static('public'))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

const User = require('./models/User')

mongoose.connect(process.env.MONGO_URI)
	.then(() => {
		console.log("baglanildi");
	})
	.catch((err) => {
		console.log("baglanti hatasi");
		console.log(err);
	})

app.get('/', async(req, res) => {
	const pagetitle = "dinamik baslik";


	res.render('book', {
		title: pagetitle,
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

	res.render('login', {
		title: pagetitle
	});
})
app.get('/register', (req, res) => {
	const pagetitle = "dinamik baslik";

	res.render('register', {
		title: pagetitle
	});
})
app.use('/profile', userRoutes);
app.use('/api/barbers',barberRoutes);
app.use('/api/appointments',appointmentRoutes);
app.listen(port, () => {
	console.log(`the server working port : ${port}`);
})