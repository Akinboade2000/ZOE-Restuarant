window.ZOE_API_URL = (() => {
  if (window.location.protocol === 'file:') {
    return 'http://localhost:5000/api';
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalHost && window.location.port !== '5000') {
    return 'http://localhost:5000/api';
  }

  return `${window.location.origin}/api`;
})();
