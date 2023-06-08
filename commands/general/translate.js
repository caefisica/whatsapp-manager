async function translateText(text, targetLang = 'en') {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: "es", target: targetLang })
  });
  const data = await response.json();
  return data.translatedText;
}

module.exports = translateText;
