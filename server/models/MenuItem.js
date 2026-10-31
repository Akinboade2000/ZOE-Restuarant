const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true }, // in Naira
  image: String,
  category: { type: String, default: 'main' },
  available: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);