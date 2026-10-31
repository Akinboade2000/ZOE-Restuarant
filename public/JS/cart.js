// Cart utility - include in all pages
const Cart = {
  get() {
    const storedCart = localStorage.getItem('zoe-cart');
    if (!storedCart) return [];

    try {
      const cart = JSON.parse(storedCart);
      if (!Array.isArray(cart)) throw new TypeError('Cart data must be an array');
      return cart.filter(item =>
        item &&
        typeof item.name === 'string' &&
        Number.isFinite(Number(item.price)) &&
        Number(item.price) > 0 &&
        Number.isInteger(Number(item.quantity)) &&
        Number(item.quantity) > 0
      ).map(item => ({
        ...item,
        price: Number(item.price),
        quantity: Number(item.quantity)
      }));
    } catch (error) {
      console.error('Unable to read saved cart:', error);
      localStorage.removeItem('zoe-cart');
      return [];
    }
  },

  save(cart) {
    localStorage.setItem('zoe-cart', JSON.stringify(cart));
    this.updateBadge();
    this.updatePreview();
  },

  add(item) {
    if (!item || typeof item.name !== 'string' || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0) {
      throw new TypeError('Cart items need a name and a valid positive price');
    }
    const cart = this.get();
    const existing = cart.find(i => i.name === item.name);
    if (existing) {
      existing.quantity += 1;
      existing.price = Number(item.price);
    } else {
      cart.push({ ...item, price: Number(item.price), quantity: 1 });
    }
    this.save(cart);
    this.notify(`${item.name} added to cart`);
  },

  remove(name) {
    const cart = this.get().filter(i => i.name !== name);
    this.save(cart);
  },

  updateQty(name, qty) {
    const cart = this.get();
    const item = cart.find(i => i.name === name);
    if (!item || !Number.isInteger(qty)) return;
    if (qty <= 0) return this.remove(name);
    item.quantity = qty;
    this.save(cart);
  },

  clear() {
    this.save([]);
  },

  total() {
    return this.get().reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  },

  count() {
    return this.get().reduce((sum, i) => sum + Number(i.quantity), 0);
  },

  updateBadge() {
    const badge = document.getElementById('cart-badge');
    if (badge) {
      const count = this.count();
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  updatePreview() {
    const items = this.get();
    const count = this.count();
    const countLabel = document.getElementById('cart-preview-count');
    const itemList = document.getElementById('cart-preview-items');
    const total = document.getElementById('cart-preview-total');
    const moreItems = document.getElementById('cart-preview-more');
    const emptyMessage = document.getElementById('cart-preview-empty');
    const toggle = document.getElementById('cart-preview-toggle');
    const countBadge = document.getElementById('cart-preview-badge');

    if (!countLabel || !itemList || !total || !moreItems || !emptyMessage || !toggle || !countBadge) return;

    countLabel.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    countBadge.textContent = count;
    countBadge.hidden = count === 0;
    toggle.setAttribute('aria-label', `Open cart, ${count} ${count === 1 ? 'item' : 'items'}`);
    total.textContent = `₦${this.total().toLocaleString()}`;
    itemList.replaceChildren();
    itemList.hidden = items.length === 0;
    emptyMessage.hidden = items.length > 0;

    items.slice(0, 3).forEach(item => {
      const row = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'cart-preview__name';
      name.textContent = item.name;

      const quantity = document.createElement('span');
      quantity.className = 'cart-preview__quantity';
      quantity.textContent = `×${item.quantity}`;

      row.append(name, quantity);
      itemList.appendChild(row);
    });

    const hiddenItemCount = items.length - 3;
    moreItems.textContent = hiddenItemCount > 0
      ? `and ${hiddenItemCount} more ${hiddenItemCount === 1 ? 'item' : 'items'}`
      : '';
    moreItems.hidden = hiddenItemCount <= 0;
  },

  notify(msg) {
    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};

// Update badge on load
document.addEventListener('DOMContentLoaded', () => {
  Cart.updateBadge();
  Cart.updatePreview();

  const toggle = document.getElementById('cart-preview-toggle');
  const details = document.getElementById('cart-preview-details');
  const closeButton = document.getElementById('cart-preview-close');
  if (!toggle || !details) return;

  const setExpanded = expanded => {
    toggle.setAttribute('aria-expanded', String(expanded));
    details.hidden = !expanded;
  };

  toggle.addEventListener('click', () => {
    setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
  });

  if (closeButton) closeButton.addEventListener('click', () => setExpanded(false));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setExpanded(false);
  });

  document.addEventListener('click', event => {
    if (
      !event.target.closest('#cart-preview') &&
      !event.target.closest('.menu__button')
    ) {
      setExpanded(false);
    }
  });
});