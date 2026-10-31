const router = require('express').Router();
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');

const PAYSTACK_API_URL = 'https://api.paystack.co';

function getPaystackSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_')) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured');
  }
  return secretKey;
}

function getCallbackUrl(req, orderId) {
  const clientUrl = process.env.CLIENT_URL || req.get('origin');
  if (!clientUrl) throw new Error('Set CLIENT_URL to the website URL used for checkout');

  const baseUrl = new URL(clientUrl);
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('CLIENT_URL must use HTTP or HTTPS');
  }

  const callbackUrl = new URL('order-success.html', `${baseUrl.href.replace(/\/?$/, '/')}`);
  callbackUrl.searchParams.set('orderId', orderId.toString());
  return callbackUrl.toString();
}

router.post('/initialize', async (req, res) => {
  let order;
  try {
    const { orderData } = req.body;
    const customer = orderData && orderData.customer;
    const requestedItems = orderData && orderData.items;

    if (
      !customer ||
      !['name', 'email', 'phone', 'address'].every(field =>
        typeof customer[field] === 'string' && customer[field].trim().length > 0
      ) ||
      customer.name.trim().length > 200 ||
      customer.email.trim().length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) ||
      customer.phone.trim().length > 100 ||
      customer.address.trim().length > 500 ||
      !Array.isArray(requestedItems) ||
      requestedItems.length === 0 ||
      requestedItems.length > 100
    ) {
      return res.status(400).json({ error: 'Valid customer details and order items are required.' });
    }

    const itemNames = requestedItems.map(item => item && item.name);
    if (itemNames.some(name => typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'The order contains an invalid menu item.' });
    }

    const menuItems = await MenuItem.find({
      name: { $in: itemNames },
      available: true,
    });
    const menuByName = new Map(menuItems.map(item => [item.name, item]));
    const orderItems = [];

    for (const requestedItem of requestedItems) {
      const menuItem = menuByName.get(requestedItem.name);
      if (!menuItem) {
        return res.status(400).json({ error: `${requestedItem.name} is no longer available.` });
      }
      if (!Number.isInteger(requestedItem.quantity) || requestedItem.quantity < 1 || requestedItem.quantity > 99) {
        return res.status(400).json({ error: 'Order quantities must be between 1 and 99.' });
      }

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: requestedItem.quantity,
      });
    }

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const amountInKobo = total * 100;
    if (!Number.isSafeInteger(amountInKobo) || amountInKobo <= 0) {
      return res.status(400).json({ error: 'The order total is invalid.' });
    }

    const reference = `zoe_${randomUUID().replace(/-/g, '')}`;
    order = new Order({
      customer: {
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
        address: customer.address.trim(),
      },
      items: orderItems,
      total,
      paymentReference: reference,
      status: 'pending',
    });

    const response = await fetch(`${PAYSTACK_API_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: customer.email.trim(),
        amount: amountInKobo,
        currency: 'NGN',
        reference,
        callback_url: getCallbackUrl(req, order._id),
        metadata: {
          orderId: order._id.toString(),
          customerName: customer.name.trim(),
          customerPhone: customer.phone.trim(),
        },
      }),
    });
    const result = await response.json();

    if (!response.ok || !result.status || !result.data || !result.data.authorization_url) {
      console.error('Paystack transaction initialization failed:', result.message || response.status);
      return res.status(502).json({ error: 'Unable to start your Paystack payment. Please try again.' });
    }

    await order.save();
    res.json({
      authorizationUrl: result.data.authorization_url,
      reference,
      orderId: order._id,
      total,
    });
  } catch (error) {
    console.error('Unable to initialize Paystack payment:', error);
    res.status(500).json({ error: 'Unable to start payment. Check the server payment configuration and try again.' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { orderId, reference } = req.body;
    if (
      typeof orderId !== 'string' ||
      !mongoose.isValidObjectId(orderId) ||
      typeof reference !== 'string' ||
      !/^zoe_[a-f0-9]{32}$/.test(reference)
    ) {
      return res.status(400).json({ error: 'A valid order and payment reference are required.' });
    }

    const order = await Order.findOne({ _id: orderId, paymentReference: reference });
    if (!order) return res.status(404).json({ error: 'Order not found for this payment.' });

    const response = await fetch(
      `${PAYSTACK_API_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${getPaystackSecretKey()}` } }
    );
    const result = await response.json();
    const transaction = result.data;

    if (
      !response.ok ||
      !result.status ||
      !transaction ||
      transaction.status !== 'success' ||
      transaction.reference !== reference ||
      transaction.amount !== order.total * 100 ||
      transaction.currency !== 'NGN'
    ) {
      return res.status(400).json({ success: false, error: 'Paystack has not confirmed this payment.' });
    }

    if (order.status === 'paid') return res.json({ success: true });
    if (order.status !== 'pending') {
      return res.status(409).json({ error: 'This order cannot be marked as paid.' });
    }

    order.status = 'paid';
    await order.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Unable to verify Paystack payment:', error);
    res.status(500).json({ error: 'Unable to verify payment. Please try again or contact support.' });
  }
});

module.exports = router;
