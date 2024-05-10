const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    courseId: String,
    userEmail: String,
    itemName: String,
    paymentAmount: Number,
    createdAt: Date,
});

module.exports = paymentSchema;