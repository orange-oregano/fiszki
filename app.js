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
// { id, en, pl, example, pos, topic, level (0–5), added (data) }
// pos   = część mowy (kod, np. "verb"), puste = nie wybrano
// topic = kategoria tematyczna (np. "dom"), puste = bez kategorii

// ---------- 1b. Części mowy i kategorie ----------

// Stała lista części mowy: kod → polska nazwa
const POS = {
  noun: 'rzeczownik',
  verb: 'czasownik',
  adj: 'przymiotnik',
  adv: 'przysłówek',
  phrase: 'zwrot',
  other: 'inne',
};

// Inne nazwy, które rozpoznajemy w pliku CSV
const POS_ALIASES = {
  noun: ['rzeczownik', 'noun', 'n'],
  verb: ['czasownik', 'verb', 'v'],
  adj: ['przymiotnik', 'adjective', 'adj'],
  adv: ['przyslowek', 'adverb', 'adv'],
  phrase: ['zwrot', 'wyrazenie', 'phrase', 'idiom'],
  other: ['inne', 'other'],
};

// Zamienia tekst (np. "Czasownik" albo "verb") na kod ("verb"), lub null
function parsePos(text) {
  const t = normalize(text).replace(/\.$/, '');
  if (!t) return '';
  for (const [code, names] of Object.entries(POS_ALIASES)) {
    if (names.includes(t)) return code;
  }
  return null; // nie rozpoznano
}

// Podpowiedzi kategorii na start (dopóki nie masz własnych)
const DEFAULT_TOPICS = [
  'dom', 'szkoła', 'praca', 'jedzenie', 'owoce', 'warzywa', 'zwierzęta',
  'podróże', 'ciało', 'emocje', 'czas wolny',
];

// Wszystkie kategorie, których używasz (bez powtórek, alfabetycznie)
function getTopics() {
  const map = new Map();
  for (const w of words) {
    if (w.topic && !map.has(w.topic.toLowerCase())) map.set(w.topic.toLowerCase(), w.topic);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'pl'));
}

// Ujednolica wpisaną kategorię: "  Dom " → "Dom",
// a jeśli już masz "dom", używa istniejącej pisowni
function cleanTopic(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return getTopics().find(x => x.toLowerCase() === t.toLowerCase()) || t;
}

// Wypełnia listę <select> częściami mowy
function fillPosSelect(select, firstLabel) {
  select.innerHTML = '';
  select.append(new Option(firstLabel, ''));
  for (const [code, label] of Object.entries(POS)) {
    select.append(new Option(label, code));
  }
}

// Odświeża podpowiedzi kategorii w formularzach
function updateTopicSuggestions() {
  const list = document.getElementById('topic-suggestions');
  list.innerHTML = '';
  const all = new Map();
  [...getTopics(), ...DEFAULT_TOPICS].forEach(t => {
    if (!all.has(t.toLowerCase())) all.set(t.toLowerCase(), t);
  });
  for (const t of all.values()) list.append(new Option(t));
}

// Plakietki "czasownik" / "dom" do karty i listy
function renderTags(container, word) {
  container.innerHTML = '';
  if (word.pos && POS[word.pos]) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = POS[word.pos];
    container.append(tag);
  }
  if (word.topic) {
    const tag = document.createElement('span');
    tag.className = 'tag topic';
    tag.textContent = word.topic;
    container.append(tag);
  }
}

// ---------- 2. Wybieranie słówka do nauki ----------

// Waga = jak często słówko ma się pojawiać.
// level 0 → 32, level 1 → 16, ... level 5 → 1
// Czyli słówka "nie umiem" (level 0) pojawiają się dużo częściej.
function weightOf(word) {
  return Math.pow(2, MAX_LEVEL - word.level);
}

let currentWord = null;

// ---------- 2b. Filtry nauki ----------

// Wartości filtrów: '' = wszystkie, '__none__' = bez części mowy / kategorii
const FILTER_KEY = 'fiszki-filters';
const NONE = '__none__';

function loadFilters() {
  try {
    return { pos: '', topic: '', ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') };
  } catch (e) {
    return { pos: '', topic: '' };
  }
}
let filters = loadFilters();

function saveFilters() {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch (e) {}
}

function matchesFilters(word) {
  if (filters.pos === NONE && word.pos) return false;
  if (filters.pos && filters.pos !== NONE && word.pos !== filters.pos) return false;
  const topic = (word.topic || '').toLowerCase();
  if (filters.topic === NONE && topic) return false;
  if (filters.topic && filters.topic !== NONE && topic !== filters.topic.toLowerCase()) return false;
  return true;
}

// Słówka, które pasują do wybranych filtrów
function filteredWords() {
  return words.filter(matchesFilters);
}

const filterPos = document.getElementById('filter-pos');
const filterTopic = document.getElementById('filter-topic');

// Buduje listy filtrów od nowa (z liczbą słówek w nawiasie)
function renderFilters() {
  const count = (fn) => words.filter(fn).length;

  filterPos.innerHTML = '';
  filterPos.append(new Option('Wszystkie części mowy', ''));
  for (const [code, label] of Object.entries(POS)) {
    const n = count(w => w.pos === code);
    if (n) filterPos.append(new Option(`${label} (${n})`, code));
  }
  const noPos = count(w => !w.pos);
  if (noPos && noPos < words.length) filterPos.append(new Option(`bez części mowy (${noPos})`, NONE));

  filterTopic.innerHTML = '';
  filterTopic.append(new Option('Wszystkie kategorie', ''));
  for (const t of getTopics()) {
    const n = count(w => (w.topic || '').toLowerCase() === t.toLowerCase());
    filterTopic.append(new Option(`${t} (${n})`, t));
  }
  const noTopic = count(w => !w.topic);
  if (noTopic && noTopic < words.length) filterTopic.append(new Option(`bez kategorii (${noTopic})`, NONE));

  // Jeśli zapisany filtr już nie istnieje (np. usunięto słówka) – wróć do "wszystkie"
  for (const [select, key] of [[filterPos, 'pos'], [filterTopic, 'topic']]) {
    const exists = [...select.options].some(o => o.value.toLowerCase() === filters[key].toLowerCase());
    if (!exists) filters[key] = '';
    const match = [...select.options].find(o => o.value.toLowerCase() === filters[key].toLowerCase());
    select.value = match ? match.value : '';
    select.classList.toggle('active', select.value !== '');
  }

  // Gdy żadne słówko nie ma jeszcze kategorii – podpowiedź w liście
  if (filterTopic.options.length === 1) {
    const hint = new Option('Brak kategorii – dodaj je przy słówkach (✏️ w Liście)', '');
    hint.disabled = true;
    filterTopic.append(hint);
  }
  if (filterPos.options.length === 1) {
    const hint = new Option('Brak części mowy – dodaj je przy słówkach', '');
    hint.disabled = true;
    filterPos.append(hint);
  }

  // Filtry widoczne zawsze, gdy masz jakiekolwiek słówka
  document.getElementById('filters').classList.toggle('hidden', words.length === 0);
}

function onFilterChange() {
  filters = { pos: filterPos.value, topic: filterTopic.value };
  saveFilters();
  currentWord = null;
  showNextCard();
}
filterPos.addEventListener('change', onFilterChange);
filterTopic.addEventListener('change', onFilterChange);

// Losowanie z wagami: im większa waga, tym większa szansa
function pickWord() {
  // Losujemy tylko spośród słówek pasujących do filtrów
  const available = filteredWords();
  // Nie pokazuj tego samego słówka dwa razy z rzędu (jeśli jest wybór)
  let pool = available;
  if (available.length > 1 && currentWord) {
    pool = available.filter(w => w.id !== currentWord.id);
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
const emptyFilter = document.getElementById('empty-filter');
const cardTags = document.getElementById('card-tags');
const stats = document.getElementById('stats');

function showNextCard() {
  renderFilters();
  updateStats();

  const noWords = words.length === 0;
  const noMatch = !noWords && filteredWords().length === 0;
  emptyLearn.classList.toggle('hidden', !noWords);
  emptyFilter.classList.toggle('hidden', !noMatch);
  learnArea.classList.toggle('hidden', noWords || noMatch);
  if (noWords || noMatch) {
    currentWord = null;
    return;
  }

  currentWord = pickWord();
  renderTags(cardTags, currentWord);
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
  const list = filteredWords();
  const learned = list.filter(w => w.level >= 3).length;
  const ofAll = list.length < words.length ? ` (z ${words.length})` : '';
  stats.textContent = `Słówek: ${list.length}${ofAll} · dobrze znanych: ${learned}`;
}

// ---------- 4. Dodawanie słówek ----------

const addForm = document.getElementById('add-form');
const inputEn = document.getElementById('input-en');
const inputPl = document.getElementById('input-pl');
const inputExample = document.getElementById('input-example');
const inputPos = document.getElementById('input-pos');
const inputTopic = document.getElementById('input-topic');
const addMessage = document.getElementById('add-message');

fillPosSelect(inputPos, '— wybierz —');
updateTopicSuggestions();

// Tworzy nowe słówko (używane przez formularz i import CSV)
function createWord(en, pl, example, pos, topic) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    en,
    pl,
    example: example || '',
    pos: pos || '',
    topic: cleanTopic(topic),
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

  words.push(createWord(en, pl, example, inputPos.value, inputTopic.value));
  saveWords();
  updateTopicSuggestions();

  // Czyścimy słówko, ale część mowy i kategoria zostają –
  // wygodnie, gdy dodajesz kilka słówek z tej samej kategorii
  inputEn.value = '';
  inputPl.value = '';
  inputExample.value = '';
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

// Nazwy kolumn, które rozpoznajemy w nagłówku (po polsku i angielsku,
// bez polskich znaków i wielkości liter – "Część mowy" = "czesc mowy")
const COLUMN_NAMES = {
  en: ['english', 'angielski', 'angielskie', 'en', 'word', 'slowko', 'slowo'],
  pl: ['polish', 'polski', 'polskie', 'pl', 'tlumaczenie', 'translation'],
  example: ['example', 'zdanie', 'przyklad', 'przykladowe zdanie', 'sentence'],
  pos: ['czesc mowy', 'part of speech', 'pos', 'typ', 'type', 'rodzaj'],
  topic: ['kategoria', 'category', 'temat', 'topic', 'dzial'],
};

// Jeśli pierwsza linia to nagłówek, zwraca numery kolumn,
// np. { en: 0, pl: 1, topic: 2 }. Jeśli to zwykłe słówko – null.
function readHeader(fields) {
  const columns = {};
  fields.forEach((name, index) => {
    const n = normalize(name);
    for (const [key, names] of Object.entries(COLUMN_NAMES)) {
      if (names.includes(n) && columns[key] === undefined) columns[key] = index;
    }
  });
  // Nagłówek musi mieć przynajmniej 2 rozpoznane kolumny
  if (Object.keys(columns).length < 2) return null;
  if (columns.en === undefined) columns.en = 0;
  if (columns.pl === undefined) columns.pl = 1;
  return columns;
}

// Zamienia cały tekst pliku na listę słówek i dodaje nowe
function importCsv(text) {
  text = text.replace(/^﻿/, ''); // usuń niewidoczny znak BOM (Excel go dodaje)
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { added: 0, skipped: 0, errors: 0 };

  const delimiter = detectDelimiter(lines[0]);
  // Klucz do wykrywania duplikatów: "apple|jabłko"
  const existing = new Set(words.map(w => `${w.en}|${w.pl}`.toLowerCase()));
  let added = 0, skipped = 0, errors = 0, withTopic = 0;
  const glue = delimiter === '\t' ? ' ' : delimiter + ' ';

  // Nagłówek? Wtedy kolumny mogą być w dowolnej kolejności
  const header = readHeader(splitLine(lines[0], delimiter));
  const headerLength = splitLine(lines[0], delimiter).length;

  lines.forEach((line, index) => {
    if (index === 0 && header) return; // pomijamy linię nagłówka
    let fields = splitLine(line, delimiter);

    let en, pl, example, pos, topic;

    if (header) {
      // Za dużo pól = zdanie z przecinkami bez cudzysłowu → sklejamy je
      const extra = fields.length - headerLength;
      if (extra > 0 && header.example !== undefined) {
        const i = header.example;
        fields.splice(i, extra + 1, fields.slice(i, i + extra + 1).join(glue));
      }
      const get = (key) => (header[key] === undefined ? '' : fields[header[key]] || '');
      en = get('en');
      pl = get('pl');
      if (!en || !pl) { errors++; return; }
      // nierozpoznana część mowy = brak
      addWord(en, pl, get('example'), parsePos(get('pos')) || '', get('topic'));
      return;
    }

    // Bez nagłówka: angielskie, polskie, zdanie, część mowy, kategoria
    en = fields[0];
    pl = fields[1];
    if (!en || !pl) { errors++; return; }

    example = fields[2] || '';
    pos = '';
    topic = '';
    const rest = fields.slice(2);

    if (rest.length > 3) {
      // Za dużo pól: zdanie miało przecinki bez cudzysłowu.
      // Dwa ostatnie pola to część mowy i kategoria, reszta to zdanie.
      example = rest.slice(0, -2).join(glue);
      pos = parsePos(rest[rest.length - 2]);
      topic = rest[rest.length - 1];
    } else {
      pos = parsePos(fields[3]);
      topic = fields[4] || '';
    }

    // Część mowy nierozpoznana → pewnie to dalszy ciąg zdania
    if (pos === null) {
      if (rest.length === 2) { example = rest.join(glue); topic = ''; }
      pos = '';
    }

    addWord(en, pl, example, pos, topic);
  });

  // Dodaje słówko, chyba że już takie jest (duplikat)
  function addWord(en, pl, example, pos, topic) {
    const key = `${en}|${pl}`.toLowerCase();
    if (existing.has(key)) { skipped++; return; }
    existing.add(key);
    words.push(createWord(en, pl, example.trim(), pos, topic));
    added++;
    if (topic.trim()) withTopic++;
  }

  if (added > 0) {
    saveWords();
    updateTopicSuggestions();
  }
  return { added, skipped, errors, withTopic };
}

inputCsv.addEventListener('change', () => {
  const file = inputCsv.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const { added, skipped, errors, withTopic } = importCsv(reader.result);

    let text = `Dodano słówek: ${added}`;
    if (added) text += ` (z kategorią: ${withTopic})`;
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
  return [word.en, word.pl, word.example, word.topic, POS[word.pos]]
    .some(f => normalize(f).includes(query));
}

// Pomocnik: tworzy element z klasą i tekstem
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Widok listy: 'all' = wszystkie słówka, 'folders' = foldery-kategorie
const VIEW_KEY = 'fiszki-list-view';
let listView = 'all';
try { listView = localStorage.getItem(VIEW_KEY) || 'all'; } catch (e) {}

// Otwarty folder: null = lista folderów, NONE = "Bez kategorii", tekst = kategoria
let openFolder = null;

const viewButtons = document.querySelectorAll('#view-switch button');
const folderHeader = document.getElementById('folder-header');
const folderTitle = document.getElementById('folder-title');

// Czy słówko należy do folderu?
function inFolder(word, folder) {
  if (folder === NONE) return !word.topic;
  return (word.topic || '').toLowerCase() === folder.toLowerCase();
}

function renderList() {
  wordList.innerHTML = '';
  const rawQuery = searchInput.value.trim();
  const query = normalize(rawQuery);

  // Podświetl wybrany przycisk widoku
  viewButtons.forEach(b => b.classList.toggle('active', b.dataset.view === listView));

  // Folder zniknął (np. zmieniono kategorię ostatniego słówka) → wróć do folderów
  if (openFolder && !words.some(w => inFolder(w, openFolder))) openFolder = null;

  const showFolders = listView === 'folders' && !query && openFolder === null;
  const insideFolder = listView === 'folders' && !query && openFolder !== null;

  folderHeader.classList.toggle('hidden', !insideFolder);
  if (insideFolder) {
    folderTitle.textContent = openFolder === NONE ? 'Bez kategorii' : `📁 ${openFolder}`;
  }

  if (words.length === 0) {
    listEmpty.textContent = 'Lista jest pusta.';
    listEmpty.classList.remove('hidden');
    return;
  }

  if (showFolders) {
    listEmpty.classList.add('hidden');
    renderFolders();
    return;
  }

  // Najnowsze na górze, potem folder i wyszukiwanie
  const visible = [...words].reverse().filter(w =>
    matchesSearch(w, query) && (!insideFolder || inFolder(w, openFolder))
  );

  listEmpty.textContent = `Brak wyników dla „${rawQuery}”.`;
  listEmpty.classList.toggle('hidden', visible.length > 0);

  for (const word of visible) {
    wordList.appendChild(
      word.id === editingId ? renderEditItem(word) : renderWordItem(word)
    );
  }
}

// Lista folderów: każda kategoria + "Bez kategorii" na końcu
function renderFolders() {
  const folders = getTopics().map(t => ({ key: t, name: t }));
  if (words.some(w => !w.topic)) folders.push({ key: NONE, name: 'Bez kategorii' });

  for (const folder of folders) {
    const inside = words.filter(w => inFolder(w, folder.key));
    const learned = inside.filter(w => w.level >= 3).length;

    const li = el('li', 'word-item folder-item' + (folder.key === NONE ? ' no-topic' : ''));
    li.setAttribute('role', 'button');
    li.tabIndex = 0;

    const text = el('div', 'word-text');
    text.append(
      el('div', 'word-en', folder.name),
      el('div', 'folder-count', `${inside.length} ${plural(inside.length)} · dobrze znanych: ${learned}`)
    );
    li.append(el('span', 'folder-icon', folder.key === NONE ? '🗂' : '📁'), text, el('span', 'chevron', '›'));

    li.addEventListener('click', () => {
      openFolder = folder.key;
      editingId = null;
      renderList();
      window.scrollTo(0, 0);
    });
    wordList.appendChild(li);
  }
}

// Polska odmiana: 1 słówko, 2 słówka, 5 słówek
function plural(n) {
  if (n === 1) return 'słówko';
  const last = n % 10, lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'słówka';
  return 'słówek';
}

// Przełączanie Wszystkie / Foldery
viewButtons.forEach(btn => btn.addEventListener('click', () => {
  listView = btn.dataset.view;
  try { localStorage.setItem(VIEW_KEY, listView); } catch (e) {}
  openFolder = null;
  editingId = null;
  renderList();
}));

// "‹ Foldery" – powrót do listy folderów
document.getElementById('folder-back').addEventListener('click', () => {
  openFolder = null;
  editingId = null;
  renderList();
});

// "Ucz się" w folderze – przejdź do nauki tylko tej kategorii
document.getElementById('folder-learn').addEventListener('click', () => {
  filters = { pos: '', topic: openFolder };
  saveFilters();
  currentWord = null;
  goTo('learn');
});

// Zwykły wiersz: słówko, tłumaczenie, zdanie, kropki, ✏️ i 🗑
function renderWordItem(word) {
  const li = el('li', 'word-item');

  const text = el('div', 'word-text');
  text.append(el('div', 'word-en', word.en), el('div', 'word-pl', word.pl));
  if (word.example) text.append(el('div', 'word-example', word.example));
  const tags = el('div', 'tags');
  renderTags(tags, word);
  text.append(tags);

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

// Wiersz w trybie edycji: pola słówka + Zapisz / Anuluj
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

  // Część mowy i kategoria obok siebie
  const row = el('div', 'form-row');
  const posLabel = el('label', '', 'Część mowy');
  const posSelect = el('select');
  fillPosSelect(posSelect, '— brak —');
  posSelect.value = word.pos || '';
  posLabel.append(posSelect);
  const topicLabel = el('label', '', 'Kategoria');
  const topicInput = el('input');
  topicInput.type = 'text';
  topicInput.value = word.topic || '';
  topicInput.setAttribute('list', 'topic-suggestions');
  topicInput.setAttribute('autocapitalize', 'none');
  topicLabel.append(topicInput);
  row.append(posLabel, topicLabel);
  form.append(row);

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
    word.pos = posSelect.value;
    word.topic = cleanTopic(topicInput.value);
    saveWords();
    updateTopicSuggestions();

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
