const express = require('express');
const createApp = require('./server/app');

module.exports = createApp(express);
