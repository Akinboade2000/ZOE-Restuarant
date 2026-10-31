(() => {
  const fallbackItems = [
    { name: 'Fried Rice and Plantain with Peppered Chicken', price: 1500, image: 'img/Fried_rice__plantain_and_peppered_chicken-removebg-preview.png' },
    { name: 'Jollof Rice and Pork with Plantain', price: 1800, image: 'img/jollof-rice-with-pork-and-plaintain-removebg-preview.png' },
    { name: '5 Chicken Wings', price: 4000, image: 'img/chicken_wings-removebg-preview.png' },
    { name: '10 Fried Chicken', price: 8000, image: 'img/pinpng.com-fried-chicken-png-1792517__1_-removebg-preview.png' },
    { name: 'Fried Chicken', price: 9000, image: 'img/22-removebg-preview.png' },
  ];

  function renderItems(grid, items) {
    grid.replaceChildren();
    items.forEach(item => {
      if (!item || typeof item.name !== 'string' || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0) return;

      const card = document.createElement('article');
      card.className = 'menu__content';

      const image = document.createElement('img');
      image.src = item.image || 'img/dish.svg';
      image.className = 'menu__img';
      image.alt = item.name;
      image.onerror = () => {
        image.onerror = null;
        image.src = 'img/dish.svg';
      };

      const name = document.createElement('h3');
      name.className = 'menu__name';
      name.textContent = item.name;

      const detail = document.createElement('span');
      detail.className = 'menu__detail';
      detail.textContent = item.description || 'Delicious dish';

      const price = document.createElement('span');
      price.className = 'menu__preci';
      price.textContent = `₦${Number(item.price).toLocaleString()}`;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button menu__button';
      button.setAttribute('aria-label', `Add ${item.name} to cart`);
      button.innerHTML = "<i class='bx bx-cart-alt'></i>";
      button.addEventListener('click', () => Cart.add({ name: item.name, price: Number(item.price) }));

      card.append(image, name, detail, price, button);
      grid.appendChild(card);
    });

    if (!grid.children.length) {
      const empty = document.createElement('p');
      empty.className = 'menu__empty';
      empty.textContent = 'The menu is temporarily unavailable.';
      grid.appendChild(empty);
    }
  }

  async function refresh(grid) {
    try {
      const response = await fetch(`${window.ZOE_API_URL}/menu`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Menu request failed with HTTP ${response.status}`);
      const items = await response.json();
      if (!Array.isArray(items)) throw new TypeError('The menu response must be an array');
      renderItems(grid, items);
    } catch (error) {
      console.warn('Could not load the menu from the server; showing saved menu items.', error);
      if (!grid.children.length) renderItems(grid, fallbackItems);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('home-menu-grid') || document.getElementById('menu-grid');
    if (!grid) return;

    refresh(grid);
    window.addEventListener('storage', event => {
      if (event.key === 'zoe-menu-updated') refresh(grid);
    });
  });
})();
