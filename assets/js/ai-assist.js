/*
  ai-assist.js
  Optional "Explain with AI" feature. Calls the OpenAI Chat Completions
  API directly from the browser using a key the user supplies themselves.
  The key is stored only in localStorage on the user's own device and is
  sent only to api.openai.com — never to any MSDEVBUILD server, because
  this is a static, client-side-only tool with no backend.
*/

(function () {
  const keyInput = document.getElementById('ai-key');
  const askBtn = document.getElementById('btn-ai-explain');
  const output = document.getElementById('ai-output');

  if (!keyInput || !askBtn) return;

  const STORAGE_KEY = 'json-studio-openai-key';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) keyInput.value = saved;

  keyInput.addEventListener('change', () => {
    if (keyInput.value.trim()) {
      localStorage.setItem(STORAGE_KEY, keyInput.value.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  });

  async function explainJSON() {
    const apiKey = keyInput.value.trim();
    const json = window.JSONStudio && window.JSONStudio.getEditorValue ? window.JSONStudio.getEditorValue() : '';

    if (!apiKey) {
      output.style.display = 'block';
      output.textContent = 'Add your OpenAI API key above first. It stays in your browser and is sent only to api.openai.com.';
      return;
    }
    if (!json.trim()) {
      output.style.display = 'block';
      output.textContent = 'Paste some JSON and render it before asking for an explanation.';
      return;
    }

    output.style.display = 'block';
    output.textContent = 'Thinking…';
    askBtn.disabled = true;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a concise assistant that explains JSON structures to developers. Describe the shape, key fields, and anything notable in 4-6 short sentences. No markdown headers, plain prose.'
            },
            { role: 'user', content: 'Explain this JSON structure:\n\n' + json.slice(0, 6000) }
          ],
          temperature: 0.3,
          max_tokens: 350
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error('OpenAI API error (' + res.status + '): ' + errBody.slice(0, 200));
      }

      const data = await res.json();
      const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      output.textContent = text || 'No response received.';
    } catch (err) {
      output.textContent = 'Could not get an explanation: ' + err.message;
    } finally {
      askBtn.disabled = false;
    }
  }

  askBtn.addEventListener('click', explainJSON);
})();
