const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const createApp = require('./app');
const app = createApp(require('express'));

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
