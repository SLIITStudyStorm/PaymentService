const express = require('express');
const app = express();

const md5 = require('md5');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const transactionSchema = require('./transactionSchema');
const paymentSchema = require('./paymentSchema');
const { default: axios } = require('axios');


app.set('view engine', 'ejs');
dotenv.config();
app.use(express.static(__dirname + '/public'))
app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(express.json());
const Transaction = mongoose.model('Transaction', transactionSchema);
const Payment = mongoose.model('Payment', paymentSchema);

var isVerified;

function generateUniqueOrderId(courseId) {
    let timestamp = new Date().getTime();
    return `${timestamp}-${courseId}`;
}

let merchantSecret = process.env.PAYHERE_SECRET;

app.get('/', async (req, res) => {
    const courseId = req.query.courseId || req.body.courseId;
    const email = req.query.email || req.body.email;

    if (!courseId || !email) {
        return res.status(400).json({ error: 'Missing courseId or email' });
    }

    try {
        const response = await axios.get(`${process.env.COURSE_SERVER}/api/course/one/${courseId}`);
        const item = response.data.payload.name;
        const amount = response.data.payload.price;

        orderId = generateUniqueOrderId(courseId);
        let merchantId = '1226319';
        let hashedSecret = md5(merchantSecret).toString().toUpperCase();
        let amountFormatted = parseFloat(amount).toLocaleString('en-us', { minimumFractionDigits: 2 }).replaceAll(',', '');
        let currency = 'USD';
        let hash = md5(merchantId + orderId + amountFormatted + currency + hashedSecret).toString().toUpperCase();

        res.render('index', {
            email: email,
            orderId: orderId,
            courseId: courseId,
            amount: amountFormatted,
            item: item,
            hash: hash
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Error' });
    }

})

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

app.get('/return', async (req, res) => {

    try {
        const response = await axios.get(`${process.env.COURSE_SERVER}/api/course/one/${req.query.courseId}`);
        const item = response.data.payload.name;
        const amount = response.data.payload.price;

        const newPayment = new Payment({
            courseId: req.query.courseId,
            userEmail: req.query.email,
            itemName: item,
            paymentAmount: amount,
            createdAt: new Date(),
        });

        await newPayment.save();

    } catch (error) {
        console.error('Error', error.message);
        res.status(500).json({ error: 'Error' });
    }

    const data = JSON.stringify({
        userEmail: req.query.email,
        courseId: req.query.courseId
    });

    axios.post(`${process.env.LEARNER_SERVER}/enrollment/enroll`, data, {
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(function (response) {
            console.log(response.data);
            // handle success
        })
        .catch(function (error) {
            console.error(error);
            // handle error
        });

    const dataNotif = JSON.stringify({
        notifications: [
            {
                email: req.query.email,
                message: "Your payment has been successful."
            }
        ]
    });

    axios.post(`${process.env.NOTIFICATION_SERVER}/send-notification`, dataNotif, {
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(function (response) {
            console.log(response.data);
            // handle success
            res.render('success');
        })
        .catch(function (error) {
            console.error(error);
            // handle error
        });
})

app.get('/cancel', async (req, res) => {
    const email = req.query.email;
    const text = 'Your payment has been cancelled.';

    const data = JSON.stringify({
        notifications: [
            {
                email: email,
                message: text
            }
        ]
    });

    axios.post(`${process.env.NOTIFICATION_SERVER}/send-notification`, data, {
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(function (response) {
            console.log(response.data);
            res.render('cancel');
            // handle success
        })
        .catch(function (error) {
            console.error(error);
            // handle error
        });
});

app.listen(3001 || process.env.PORT, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT || 3001}`);
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