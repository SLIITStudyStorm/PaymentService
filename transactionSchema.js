const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    merchant_id: String,
    order_id: String,
    payment_id: String,
    payhere_amount: Number,
    payhere_currency: String,
    method: String,
    status_code: String,
    status_message: String,
    card_holder_name: String,
    card_no: String,
    card_expiry: String,
    created_at: Date,
    updated_at: Date,
});

module.exports = transactionSchema;