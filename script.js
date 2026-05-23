const API_URL = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4.1-mini';

const els = {
  apiKey: document.getElementById('apiKey'),
  category: document.getElementById('category'),
  tone: document.getElementById('tone'),
  scenario: document.getElementById('scenario'),
  userMessage: document.getElementById('userMessage'),
  generateBtn: document.getElementById('generateBtn'),
  clearFormBtn: document.getElementById('clearFormBtn'),
  exportBtn: document.getElementById('exportBtn'),
  clearDatasetBtn: document.getElementById('clearDatasetBtn'),
  output: document.getElementById('output'),
  countLabel: document.getElementById('countLabel')
};

let dataset = JSON.parse(localStorage.getItem('modelA_dataset') || '[]');
els.apiKey.value = localStorage.getItem('openai_api_key') || '';
render();

els.apiKey.addEventListener('input', () => {
  localStorage.setItem('openai_api_key', els.apiKey.value.trim());
});

els.clearFormBtn.addEventListener('click', () => {
  els.tone.value = '';
  els.scenario.value = '';
  els.userMessage.value = '';
});

els.clearDatasetBtn.addEventListener('click', () => {
  if (!confirm('Delete all generated examples?')) return;
  dataset = [];
  persistAndRender();
});

els.exportBtn.addEventListener('click', () => {
  const jsonl = dataset.map((row) => JSON.stringify(row)).join('\n');
  const blob = new Blob([jsonl], { type: 'application/jsonl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'model_a_dataset.jsonl';
  a.click();
  URL.revokeObjectURL(a.href);
});

els.generateBtn.addEventListener('click', generateExample);

async function generateExample() {
  const apiKey = els.apiKey.value.trim();
  const scenario = els.scenario.value.trim();
  const userMessage = els.userMessage.value.trim();
  if (!apiKey || !scenario || !userMessage) {
    alert('Please fill API key, scenario, and user message.');
    return;
  }

  els.generateBtn.disabled = true;
  els.generateBtn.textContent = 'Generating...';

  const prompt = buildPrompt({
    category: els.category.value,
    tone: els.tone.value.trim(),
    scenario,
    userMessage
  });

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        text: { format: { type: 'json_object' } }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.output_text || '';
    const parsed = JSON.parse(content);
    validateExample(parsed);
    dataset.push(parsed);
    persistAndRender();
  } catch (err) {
    alert(`Generation failed: ${err.message}`);
  } finally {
    els.generateBtn.disabled = false;
    els.generateBtn.textContent = 'Generate example ↗';
  }
}

function buildPrompt({ category, tone, scenario, userMessage }) {
  return `You are generating one training example for Model A.
Return ONLY a valid JSON object with this exact shape:
{
  "category": "string",
  "scenario": "string",
  "messages": [
    {"role":"system","content":"..."},
    {"role":"user","content":"..."},
    {"role":"assistant","content":"..."}
  ],
  "tool_call": null OR {"name":"route_to_b","arguments":{...}}
}
Rules:
- Keep assistant concise, natural, and non-sycophantic.
- Avoid words like 'Certainly', 'Of course', 'I'd be happy'.
- Category must match input category.
- Scenario must match input scenario.
- User message must be exactly included as the user turn content.
- Output one example only.
Input values:
category: ${category}
tone_hint: ${tone || 'none'}
scenario: ${scenario}
user_message: ${userMessage}`;
}

function validateExample(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid JSON object');
  if (!Array.isArray(obj.messages) || obj.messages.length < 3) throw new Error('messages must contain 3 turns');
}

function persistAndRender() {
  localStorage.setItem('modelA_dataset', JSON.stringify(dataset));
  render();
}

function render() {
  els.countLabel.textContent = `Dataset: ${dataset.length} examples`;
  if (!dataset.length) {
    els.output.textContent = 'No examples yet. Generate some above.';
    return;
  }

  els.output.innerHTML = dataset
    .map((item, i) => {
      const assistant = item.messages?.find((m) => m.role === 'assistant')?.content || '(missing assistant)';
      return `<div class="item"><strong>#${i + 1} ${escapeHtml(item.category || 'uncategorized')}</strong>\n${escapeHtml(
        assistant
      )}</div>`;
    })
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
