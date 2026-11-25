// Resolves an animated server emoji (by name) for ticket buttons, with a unicode fallback.
let clientRef = null;

function setClient(client) {
  clientRef = client;
}

function btnEmoji(name, fallback) {
  try {
    if (clientRef && clientRef.emojis && clientRef.emojis.cache) {
      const lower = String(name).toLowerCase();
      const found = clientRef.emojis.cache.find(e => e.name && e.name.toLowerCase() === lower && e.available !== false);
      if (found) return { id: found.id, name: found.name, animated: Boolean(found.animated) };
    }
  } catch (_) {}
  return fallback;
}

module.exports = { setClient, btnEmoji };
