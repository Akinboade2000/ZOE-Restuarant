// server/models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: String,
  price: Number,
  quantity: { type: Number, default: 1 },
});

const orderSchema = new mongoose.Schema({
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
  },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'preparing', 'delivering', 'completed', 'cancelled'],
    default: 'pending',
  },
  paymentIntentId: String,
  paymentReference: { type: String, index: true },
  paymentMethod: { type: String, default: 'card' },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);