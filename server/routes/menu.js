const router = require('express').Router();
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { del, put } = require('@vercel/blob');
const MenuItem = require('../models/MenuItem');
const adminAuth = require('../middleware/adminAuth');

const uploadDirectory = path.resolve(__dirname, '../../public/img/menu');
const maxImageBytes = 2.5 * 1024 * 1024;
const defaultMenuItems = [
  {
    name: 'Fried Rice and Plantain with Peppered Chicken',
    description: 'Seasoned fried rice served with sweet plantain and spicy peppered chicken.',
    price: 1500,
    image: 'img/Fried_rice__plantain_and_peppered_chicken-removebg-preview.png',
  },
  {
    name: 'Jollof Rice and Pork with Plantain',
    description: 'Smoky jollof rice with tender pork and sweet fried plantain.',
    price: 1800,
    image: 'img/jollof-rice-with-pork-and-plaintain-removebg-preview.png',
  },
  {
    name: '5 Chicken Wings',
    description: 'Five crispy, flavourful chicken wings.',
    price: 4000,
    image: 'img/chicken_wings-removebg-preview.png',
  },
  {
    name: '10 Fried Chicken',
    description: 'A generous serving of ten pieces of crispy fried chicken.',
    price: 8000,
    image: 'img/pinpng.com-fried-chicken-png-1792517__1_-removebg-preview.png',
  },
  {
    name: 'Fried Chicken',
    description: 'Golden fried chicken, crisp on the outside and tender inside.',
    price: 9000,
    image: 'img/22-removebg-preview.png',
  },
].map(item => ({ ...item, category: 'main', available: true }));
let defaultMenuSeedPromise;

function ensureDefaultMenuItems() {
  if (!defaultMenuSeedPromise) {
    defaultMenuSeedPromise = Promise.all(defaultMenuItems.map(item => MenuItem.updateOne(
      { name: item.name },
      { $setOnInsert: item },
      { upsert: true }
    ))).catch(error => {
      defaultMenuSeedPromise = undefined;
      throw error;
    });
  }

  return defaultMenuSeedPromise;
}

const imageTypes = {
  'image/jpeg': {
    extension: 'jpg',
    contentType: 'image/jpeg',
    matches(buffer) {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    },
  },
  'image/png': {
    extension: 'png',
    contentType: 'image/png',
    matches(buffer) {
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    },
  },
  'image/webp': {
    extension: 'webp',
    contentType: 'image/webp',
    matches(buffer) {
      return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    },
  },
};

// GET all menu items
router.get('/', async (req, res) => {
  try {
    await ensureDefaultMenuItems();
    const items = await MenuItem.find({ available: true });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new menu item (admin)
router.post('/', adminAuth, async (req, res) => {
  let imagePath = 'img/dish.svg';
  let savedImagePath;
  let savedBlobUrl;
  try {
    const { name, description, price, image } = req.body || {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 100 ||
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 500 ||
      !Number.isSafeInteger(Number(price)) ||
      Number(price) <= 0
    ) {
      return res.status(400).json({
        error: 'Enter a name, description, and a whole-number price greater than zero.',
      });
    }

    if (image !== undefined) {
      if (typeof image !== 'string') {
        return res.status(400).json({ error: 'The food picture must be a PNG, JPEG, or WebP image.' });
      }

      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
      if (!match) {
        return res.status(400).json({ error: 'The food picture must be a PNG, JPEG, or WebP image.' });
      }

      const fileBuffer = Buffer.from(match[2], 'base64');
      const imageType = imageTypes[match[1]];
      if (
        fileBuffer.length === 0 ||
        fileBuffer.length > maxImageBytes ||
        fileBuffer.toString('base64') !== match[2] ||
        !imageType.matches(fileBuffer)
      ) {
        return res.status(400).json({ error: 'The food picture is invalid or larger than 2.5 MB.' });
      }

      const filename = `${randomUUID()}.${imageType.extension}`;
      if (process.env.VERCEL === '1' || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
        if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
          return res.status(503).json({ error: 'Connect a Vercel Blob store before uploading food pictures.' });
        }
        const blob = await put(filename, fileBuffer, {
          access: 'public',
          contentType: imageType.contentType,
        });
        savedBlobUrl = blob.url;
        imagePath = blob.url;
      } else {
        await fs.mkdir(uploadDirectory, { recursive: true });
        const destinationPath = path.join(uploadDirectory, filename);
        await fs.writeFile(destinationPath, fileBuffer, { flag: 'wx' });
        savedImagePath = destinationPath;
        imagePath = `img/menu/${filename}`;
      }
    }

    const item = await MenuItem.create({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      image: imagePath,
      category: 'main',
      available: true,
    });
    res.status(201).json(item);
  } catch (err) {
    if (savedImagePath) {
      await fs.unlink(savedImagePath).catch(cleanupError => {
        console.error('Unable to remove unused menu image:', cleanupError);
      });
    }
    if (savedBlobUrl) {
      await del(savedBlobUrl).catch(cleanupError => {
        console.error('Unable to remove unused menu image from Vercel Blob:', cleanupError);
      });
    }
    console.error('Unable to create menu item:', err);
    res.status(400).json({ error: 'Unable to add this menu item. Please check the details and try again.' });
  }
});

module.exports = router;