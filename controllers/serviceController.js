const Service = require('../models/Service');

const createService = async (req, res) => {
    try {
        const newService = new Service(req.body);
        await newService.save();
        res.status(201).json(newService);
    } catch (error) {
        res.status(400).json({ message: 'Hizmet oluşturulurken hata.', error: error.message });
    }
};

const getAllServices = async (req, res) => {
    try {
        const services = await Service.find({});
        res.status(200).json(services);
    } catch (error) {
        res.status(400).json({ message: 'Hizmetler getirilirken hata.', error: error.message });
    }
}

module.exports = { createService, getAllServices };