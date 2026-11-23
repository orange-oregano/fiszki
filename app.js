// =====================================================
//  Fiszki – logika aplikacji
// =====================================================

// Klucz, pod którym zapisujemy dane w pamięci telefonu
const STORAGE_KEY = 'fiszki-words';
const MAX_LEVEL = 5;

// ---------- 1. Zapisywanie i wczytywanie danych ----------

// Wczytuje listę słówek z localStorage (albo pustą listę)
function loadWords() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

// Zapisuje listę słówek do localStorage (jako tekst JSON)
function saveWords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  } catch (e) {
    alert('Nie udało się zapisać danych na telefonie.');
  }
}

let words = loadWords();

// Każde słówko wygląda tak:
// { id, en, pl, example, level (0–5), added (data) }

// ---------- 2. Wybieranie słówka do nauki ----------

// Waga = jak często słówko ma się pojawiać.
// level 0 → 32, level 1 → 16, ... level 5 → 1
// Czyli słówka "nie umiem" (level 0) pojawiają się dużo częściej.
function weightOf(word) {
  return Math.pow(2, MAX_LEVEL - word.level);
}

let currentWord = null;

// Losowanie z wagami: im większa waga, tym większa szansa
function pickWord() {
  // Nie pokazuj tego samego słówka dwa razy z rzędu (jeśli jest wybór)
  let pool = words;
  if (words.length > 1 && currentWord) {
    pool = words.filter(w => w.id !== currentWord.id);
  }

  const total = pool.reduce((sum, w) => sum + weightOf(w), 0);
  let random = Math.random() * total;

  for (const word of pool) {
    random -= weightOf(word);
    if (random <= 0) return word;
  }
  return pool[pool.length - 1];
}

// ---------- 3. Ekran nauki (fiszki) ----------

const card = document.getElementById('card');
const cardWord = document.getElementById('card-word');
const cardAnswer = document.getElementById('card-answer');
const cardTranslation = document.getElementById('card-translation');
const cardExample = document.getElementById('card-example');
const cardHint = document.getElementById('card-hint');
const answerButtons = document.getElementById('answer-buttons');
const learnArea = document.getElementById('learn-area');
const emptyLearn = document.getElementById('empty-learn');
const stats = document.getElementById('stats');

function showNextCard() {
  updateStats();

  if (words.length === 0) {
    learnArea.classList.add('hidden');
    emptyLearn.classList.remove('hidden');
    currentWord = null;
    return;
  }
  learnArea.classList.remove('hidden');
  emptyLearn.classList.add('hidden');

  currentWord = pickWord();
  cardWord.textContent = currentWord.en;
  cardTranslation.textContent = currentWord.pl;
  cardExample.textContent = currentWord.example || '';

  // Karta zaczyna "zakryta"
  cardAnswer.classList.add('hidden');
  answerButtons.classList.add('hidden');
  cardHint.classList.remove('hidden');
}

// Stuknięcie w kartę = pokaż tłumaczenie
card.addEventListener('click', () => {
  if (!currentWord) return;
  cardAnswer.classList.remove('hidden');
  answerButtons.classList.remove('hidden');
  cardHint.classList.add('hidden');
});

// "Umiem" → poziom w górę (max 5)
document.getElementById('btn-know').addEventListener('click', () => {
  currentWord.level = Math.min(MAX_LEVEL, currentWord.level + 1);
  saveWords();
  showNextCard();
});

// "Nie umiem" → poziom wraca do 0, słówko będzie często wracać
document.getElementById('btn-dont-know').addEventListener('click', () => {
  currentWord.level = 0;
  saveWords();
  showNextCard();
});

function updateStats() {
  if (words.length === 0) {
    stats.textContent = '';
    return;
  }
  const learned = words.filter(w => w.level >= 3).length;
  stats.textContent = `Słówek: ${words.length} · dobrze znanych: ${learned}`;
}

// ---------- 4. Dodawanie słówek ----------

const addForm = document.getElementById('add-form');
const inputEn = document.getElementById('input-en');
const inputPl = document.getElementById('input-pl');
const inputExample = document.getElementById('input-example');
const addMessage = document.getElementById('add-message');

// Tworzy nowe słówko (używane przez formularz i import CSV)
function createWord(en, pl, example) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    en,
    pl,
    example: example || '',
    level: 0,
    added: new Date().toISOString(),
  };
}

addForm.addEventListener('submit', (event) => {
  event.preventDefault(); // nie przeładowuj strony

  const en = inputEn.value.trim();
  const pl = inputPl.value.trim();
  const example = inputExample.value.trim();
  if (!en || !pl) return;

  words.push(createWord(en, pl, example));
  saveWords();

  addForm.reset();
  addMessage.textContent = `Dodano: ${en} ✓`;
  setTimeout(() => (addMessage.textContent = ''), 2000);
  inputEn.focus(); // od razu można wpisać następne
});

// ---------- 4b. Import z pliku CSV ----------

const inputCsv = document.getElementById('input-csv');
const importMessage = document.getElementById('import-message');

// Zgaduje separator na podstawie pierwszej linii: ; , albo tabulator
function detectDelimiter(line) {
  const candidates = [';', ',', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

// Dzieli jedną linię na pola. Obsługuje cudzysłowy:
// "Hi, how are you?" to jedno pole, a "" w środku oznacza znak "
function splitLine(line, delimiter) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields.map(f => f.trim());
}

// Czy pierwsza linia to nagłówek (np. "english;polish")?
const HEADER_WORDS = ['english', 'angielski', 'angielskie', 'en', 'word', 'słówko', 'slowko'];
function isHeader(fields) {
  return HEADER_WORDS.includes(fields[0].toLowerCase());
}

// Zamienia cały tekst pliku na listę słówek i dodaje nowe
function importCsv(text) {
  text = text.replace(/^﻿/, ''); // usuń niewidoczny znak BOM (Excel go dodaje)
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { added: 0, skipped: 0, errors: 0 };

  const delimiter = detectDelimiter(lines[0]);
  // Klucz do wykrywania duplikatów: "apple|jabłko"
  const existing = new Set(words.map(w => `${w.en}|${w.pl}`.toLowerCase()));
  let added = 0, skipped = 0, errors = 0;

  lines.forEach((line, index) => {
    const fields = splitLine(line, delimiter);
    if (index === 0 && isHeader(fields)) return;

    const en = fields[0];
    const pl = fields[1];
    // Reszta pól to zdanie (gdyby zawierało przecinki bez cudzysłowu)
    const example = fields.slice(2).join(delimiter === '\t' ? ' ' : delimiter + ' ').trim();

    if (!en || !pl) { errors++; return; }

    const key = `${en}|${pl}`.toLowerCase();
    if (existing.has(key)) { skipped++; return; }

    existing.add(key);
    words.push(createWord(en, pl, example));
    added++;
  });

  if (added > 0) saveWords();
  return { added, skipped, errors };
}

inputCsv.addEventListener('change', () => {
  const file = inputCsv.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const { added, skipped, errors } = importCsv(reader.result);

    let text = `Dodano słówek: ${added}`;
    if (skipped) text += ` · pominięto duplikaty: ${skipped}`;
    if (errors) text += ` · błędne linie: ${errors}`;
    importMessage.textContent = text;
    importMessage.classList.toggle('error', added === 0);

    inputCsv.value = ''; // pozwala wybrać ten sam plik jeszcze raz
  };
  reader.onerror = () => {
    importMessage.textContent = 'Nie udało się odczytać pliku.';
    importMessage.classList.add('error');
  };
  reader.readAsText(file, 'UTF-8');
});

// ---------- 5. Lista słówek (wyszukiwanie + edycja) ----------

const wordList = document.getElementById('word-list');
const listEmpty = document.getElementById('list-empty');
const searchInput = document.getElementById('search');

// id słówka, które właśnie edytujemy (null = żadne)
let editingId = null;

// Ujednolica tekst do wyszukiwania: małe litery, bez polskich znaków
// "Żółw" → "zolw", dzięki temu "zolw" też znajdzie "żółw"
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function matchesSearch(word, query) {
  if (!query) return true;
  return [word.en, word.pl, word.example].some(f => normalize(f).includes(query));
}

// Pomocnik: tworzy element z klasą i tekstem
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderList() {
  wordList.innerHTML = '';
  const query = normalize(searchInput.value.trim());

  // Najnowsze na górze, potem filtr wyszukiwania
  const visible = [...words].reverse().filter(w => matchesSearch(w, query));

  if (words.length === 0) {
    listEmpty.textContent = 'Lista jest pusta.';
  } else if (visible.length === 0) {
    listEmpty.textContent = `Brak wyników dla „${searchInput.value.trim()}”.`;
  }
  listEmpty.classList.toggle('hidden', visible.length > 0);

  for (const word of visible) {
    wordList.appendChild(
      word.id === editingId ? renderEditItem(word) : renderWordItem(word)
    );
  }
}

// Zwykły wiersz: słówko, tłumaczenie, zdanie, kropki, ✏️ i 🗑
function renderWordItem(word) {
  const li = el('li', 'word-item');

  const text = el('div', 'word-text');
  text.append(el('div', 'word-en', word.en), el('div', 'word-pl', word.pl));
  if (word.example) text.append(el('div', 'word-example', word.example));

  // Kropki = poziom znajomości
  const level = el('div', 'level');
  level.title = `Poziom ${word.level} z ${MAX_LEVEL}`;
  for (let i = 1; i <= MAX_LEVEL; i++) {
    level.appendChild(el('span', i <= word.level ? 'on' : ''));
  }

  const edit = el('button', 'icon-btn', '✏️');
  edit.setAttribute('aria-label', `Edytuj ${word.en}`);
  edit.addEventListener('click', () => {
    editingId = word.id;
    renderList();
  });

  const del = el('button', 'delete-btn', '🗑');
  del.setAttribute('aria-label', `Usuń ${word.en}`);
  del.addEventListener('click', () => {
    if (confirm(`Usunąć „${word.en}”?`)) {
      words = words.filter(w => w.id !== word.id);
      saveWords();
      renderList();
    }
  });

  li.append(text, level, edit, del);
  return li;
}

// Wiersz w trybie edycji: trzy pola + Zapisz / Anuluj
function renderEditItem(word) {
  const li = el('li', 'word-item editing');
  const form = el('form', 'form edit-form');
  form.autocomplete = 'off';

  function field(labelText, value, multiline) {
    const label = el('label', '', labelText);
    const input = el(multiline ? 'textarea' : 'input');
    if (multiline) input.rows = 2;
    else input.type = 'text';
    input.value = value || '';
    input.setAttribute('autocapitalize', 'none');
    label.appendChild(input);
    form.appendChild(label);
    return input;
  }

  const inputEn = field('Po angielsku', word.en);
  const inputPl = field('Tłumaczenie', word.pl);
  const inputEx = field('Przykładowe zdanie', word.example, true);
  inputEn.required = true;
  inputPl.required = true;

  const buttons = el('div', 'edit-buttons');
  const cancel = el('button', 'btn secondary', 'Anuluj');
  cancel.type = 'button';
  cancel.addEventListener('click', () => {
    editingId = null;
    renderList();
  });
  const save = el('button', 'btn primary', 'Zapisz');
  save.type = 'submit';
  buttons.append(cancel, save);
  form.appendChild(buttons);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const en = inputEn.value.trim();
    const pl = inputPl.value.trim();
    if (!en || !pl) return;

    // Zmieniamy tylko teksty – poziom znajomości zostaje
    word.en = en;
    word.pl = pl;
    word.example = inputEx.value.trim();
    saveWords();

    editingId = null;
    renderList();
  });

  li.appendChild(form);
  return li;
}

// Wyszukiwanie na bieżąco, przy każdej wpisanej literze
searchInput.addEventListener('input', () => {
  editingId = null;
  renderList();
});

// ---------- 6. Przełączanie ekranów (zakładki) ----------

const titles = { learn: 'Ucz się', add: 'Dodaj słówko', list: 'Twoje słówka' };

function goTo(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');

  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.goto === name)
  );
  document.getElementById('screen-title').textContent = titles[name];

  if (name === 'learn') showNextCard();
  if (name === 'list') renderList();
  window.scrollTo(0, 0);
}

// Każdy przycisk z atrybutem data-goto przełącza ekran
document.querySelectorAll('[data-goto]').forEach(btn =>
  btn.addEventListener('click', () => goTo(btn.dataset.goto))
);

// ---------- 7. Start ----------

showNextCard();

// Service worker = aplikacja działa też bez internetu
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
