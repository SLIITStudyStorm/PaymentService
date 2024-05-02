const express = require('express');
const app = express();

const md5 = require('md5');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const transactionSchema = require('./transactionSchema');

dotenv.config();
app.use(express.static(__dirname + '/public'))
app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(express.json());
const Transaction = mongoose.model('Transaction', transactionSchema);


var isVerified;

app.get('/', (req, res) => {
    // render something
})

let merchantSecret = process.env.PAYHERE_SECRET;

app.post('/hash', (req, res) => {
    let orderId = req.body.order_id;
    let amount = req.body.amount;

    if (!orderId || !amount) {
        return res.status(400).json({ error: 'Missing order_id or amount' });
    }

    let hashedSecret = md5(merchantSecret).toString().toUpperCase();
    let amountFormatted = parseFloat(amount).toLocaleString('en-us', { minimumFractionDigits: 2 }).replaceAll(',', '');
    let currency = 'LKR';
    let hash = md5(orderId + amountFormatted + currency + hashedSecret).toString().toUpperCase();

    res.json({
        "order_id": orderId,
        "amount": amount,
        "currency": currency,
        "hash": hash
    });
});

app.post('/notify', async (req, res) => {

    isVerified = false;
    var merchant_id = req.body.merchant_id;
    var order_id = req.body.order_id;
    var payment_id = req.body.payment_id;
    var payhere_amount = req.body.payhere_amount;
    var payhere_currency = req.body.payhere_currency;
    var method = req.body.method;

    var status_code = req.body.status_code;
    var status_message = req.body.status_message;

    if (req.body.card_holder_name) {
        var card_holder_name = req.body.card_holder_name;
        var card_no = req.body.card_no;
        var card_expiry = req.body.card_expiry;
    }

    switch (status_code) {
        case "0":
            console.log('Transaction is Pending');
            break;
        case "2":
            console.log("Transaction is Successful");


            var localMd5Sig = (md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5(process.env.PAYHERE_SECRET).toUpperCase())).toUpperCase();
            if (localMd5Sig === req.body.md5sig) {
                console.log('Verified')
                isVerified = true;

                // save the transaction details to the database
                const newTransaction = new Transaction({
                    merchant_id: req.body.merchant_id,
                    order_id: req.body.order_id,
                    payment_id: req.body.payment_id,
                    payhere_amount: req.body.payhere_amount,
                    payhere_currency: req.body.payhere_currency,
                    method: req.body.method,
                    status_code: req.body.status_code,
                    status_message: req.body.status_message,
                    card_holder_name: req.body.card_holder_name,
                    card_no: req.body.card_no,
                    card_expiry: req.body.card_expiry,
                    created_at: new Date(),
                    updated_at: new Date(),
                });

                await newTransaction.save();

                console.log('Transaction saved to the database');

            } else {
                console.log("Unverified")
                isVerified = false;
            }
            break;
        case "-1":
            console.log("Transaction Canceled");
            break;
        case "-2":
            console.log("Transaction Failed");
            break;
        case "-3":
            console.log("Charged Back");
            break;
        default:
            console.log("Unknown Error");
    }
    res.end();
})

app.get('/check', (req, res) => {
    res.send({ "Verified": isVerified })
})

app.get('/return', (req, res) => {
    res.send('success');
})

app.get('/cancel', (req, res) => {
    res.send('cancel');
})

app.listen(3000 || process.env.PORT, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
})

try {
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
} catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1); // Exit process with failure
}