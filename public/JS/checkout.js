const API_URL = window.ZOE_API_URL;

const form = document.getElementById('checkout-form');
const payButton = document.getElementById('pay-btn');
const paymentMessage = document.getElementById('payment-message');
let submitting = false;
let mapUpdateTimer;

const addressInput = document.getElementById('address');
const addressMap = document.getElementById('address-map');
const openAddressMap = document.getElementById('open-address-map');

function updateAddressMap() {
  const address = addressInput.value.trim() || 'OAU Ile-Ife';
  const query = encodeURIComponent(address);
  addressMap.src = `https://maps.google.com/maps?q=${query}&output=embed`;
  openAddressMap.href = `https://www.google.com/maps/search/?api=1&query=${query}`;
}

addressInput.addEventListener('input', () => {
  window.clearTimeout(mapUpdateTimer);
  mapUpdateTimer = window.setTimeout(updateAddressMap, 500);
});

function showMessage(message) {
  paymentMessage.textContent = message;
}

function renderCart() {
  const items = Cart.get();
  const container = document.getElementById('order-items');

  if (items.length === 0) {
    container.innerHTML = '<p>Your cart is empty. <a href="menu.html">Browse menu</a></p>';
    document.getElementById('order-total').textContent = '₦0';
    payButton.disabled = true;
    return;
  }

  container.replaceChildren();
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';

    const details = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;

    const controls = document.createElement('span');
    controls.className = 'qty-controls';

    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.setAttribute('aria-label', `Remove one ${item.name}`);
    decrement.textContent = '−';
    decrement.addEventListener('click', () => changeQty(item.name, -1));

    const quantity = document.createElement('span');
    quantity.textContent = item.quantity;

    const increment = document.createElement('button');
    increment.type = 'button';
    increment.setAttribute('aria-label', `Add one ${item.name}`);
    increment.textContent = '+';
    increment.addEventListener('click', () => changeQty(item.name, 1));

    controls.append(decrement, quantity, increment);
    details.append(name, controls);

    const lineTotal = document.createElement('span');
    lineTotal.textContent = `₦${(item.price * item.quantity).toLocaleString()}`;
    row.append(details, lineTotal);
    container.appendChild(row);
  });

  document.getElementById('order-total').textContent = `₦${Cart.total().toLocaleString()}`;
  payButton.disabled = submitting;
}

function changeQty(name, delta) {
  if (submitting) return;
  const item = Cart.get().find(cartItem => cartItem.name === name);
  if (!item) return;

  Cart.updateQty(name, item.quantity + delta);
  renderCart();
}

async function initializePaystack() {
  const items = Cart.get();
  const orderData = {
    customer: {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
    },
    items: items.map(item => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    total: Cart.total(),
  };

  let response;
  try {
    response = await fetch(`${API_URL}/payments/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderData }),
    });
  } catch (error) {
    throw new Error('Cannot reach the restaurant server. Start it with "npm --prefix server start", then open the site at http://localhost:5000.');
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}). Check that the backend is running.`);
  }

  if (!response.ok || !data.authorizationUrl) {
    throw new Error(data.error || 'Unable to start your Paystack payment.');
  }

  const authorizationUrl = new URL(data.authorizationUrl);
  if (authorizationUrl.protocol !== 'https:' || authorizationUrl.hostname !== 'checkout.paystack.com') {
    throw new Error('Paystack returned an invalid checkout address.');
  }
  window.location.assign(authorizationUrl.toString());
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  if (!Cart.get().length) {
    showMessage('Your cart is empty. Add an item before checking out.');
    payButton.disabled = true;
    return;
  }

  submitting = true;
  payButton.disabled = true;
  document.querySelectorAll('.qty-controls button').forEach(button => {
    button.disabled = true;
  });
  payButton.textContent = 'Connecting to Paystack...';
  showMessage('Preparing your secure payment...');

  try {
    await initializePaystack();
  } catch (error) {
    console.error('Checkout failed:', error);
    showMessage(error.message || 'Checkout failed. Please try again.');
  } finally {
    submitting = false;
    document.querySelectorAll('.qty-controls button').forEach(button => {
      button.disabled = false;
    });
    payButton.disabled = Cart.get().length === 0;
    payButton.textContent = 'Pay with Paystack';
  }
});

renderCart();
updateAddressMap();
