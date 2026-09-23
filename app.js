'use strict';

// UI: navigation, categories, client-side brief. No network requests or storage.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let effectsPaused = motionPreference.matches;
function setEffectsPaused(paused) {
  effectsPaused = Boolean(paused || motionPreference.matches);
  document.body.classList.toggle('effects-off', effectsPaused);
  document.documentElement.classList.toggle('effects-off', effectsPaused);
  const button = $('#effects-toggle');
  const label = motionPreference.matches
    ? 'Движение отключено в настройках системы'
    : effectsPaused ? 'Включить эффекты' : 'Остановить эффекты';
  button.setAttribute('aria-pressed', String(effectsPaused));
  button.setAttribute('aria-disabled', String(motionPreference.matches));
  button.setAttribute('aria-label', label);
  button.title = label;
  button.firstElementChild.textContent = effectsPaused ? '▷' : 'Ⅱ';
  document.dispatchEvent(new CustomEvent('effectschange', { detail: { paused: effectsPaused } }));
}
$('#effects-toggle').addEventListener('click', () => setEffectsPaused(!effectsPaused));
motionPreference.addEventListener('change', event => setEffectsPaused(event.matches));
setEffectsPaused(effectsPaused);
const menuButton = $('.menu-toggle');
const mobileNav = $('#mobile-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Открыть меню');
  mobileNav.hidden = true;
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  mobileNav.hidden = !open;
});
$$('a', mobileNav).forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden && !document.querySelector('dialog[open]')) {
    closeMenu();
    menuButton.focus();
  }
});
window.addEventListener('resize', () => { if (window.innerWidth > 800) closeMenu(); }, { passive: true });

const progressBar = $('.scroll-progress');
let scrollTick = false;
function updateProgress() {
  const range = document.documentElement.scrollHeight - window.innerHeight;
  const progress = range > 0 ? Math.max(0, Math.min(1, window.scrollY / range)) : 0;
  progressBar.style.transform = `scaleX(${progress})`;
  const dock = $('#quick-dock');
  // A focused dock stays available even if an anchor scrolls to the top.
  dock.hidden = window.scrollY < 280 && !dock.contains(document.activeElement);
  let activeSection = 'main';
  for (const id of ['services', 'playground', 'contact']) {
    if (document.getElementById(id).getBoundingClientRect().top <= window.innerHeight * 0.48) activeSection = id;
  }
  $$('[data-dock-section]').forEach(link => {
    if (link.dataset.dockSection === activeSection) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  scrollTick = false;
}
window.addEventListener('scroll', () => {
  if (!scrollTick) { scrollTick = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
updateProgress();

if ('IntersectionObserver' in window && !motionPreference.matches) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('is-pending');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
  $$('.reveal').forEach(element => { element.classList.add('is-pending'); revealObserver.observe(element); });
}

const cards = $$('.service-card');
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  const category = button.dataset.filter;
  $$('[data-filter]').forEach(item => {
    const selected = item === button;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  cards.forEach(card => {
    card.hidden = category !== 'all' && card.dataset.category !== category;
    if (!card.hidden) card.classList.remove('is-pending');
  });
  const count = cards.filter(card => !card.hidden).length;
  $('#filter-status').textContent = `Показано направлений: ${count}.`;
  updateProgress();
}));

let toastTimer;
function showToast(message) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3400);
}
async function copyText(text, container = document.body) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch { /* The permission may be denied; try the compatible local fallback. */ }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:0;top:0;opacity:0;width:1px;height:1px;';
  const previousFocus = document.activeElement;
  container.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  previousFocus?.focus({ preventScroll: true });
  return copied;
}
$$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const copied = await copyText(button.dataset.copy);
  showToast(copied ? 'Контакт скопирован. Увидимся в Telegram.' : 'Скопируй контакт вручную: @no_i_lord');
}));

const dialog = $('#request-dialog');
const typeInput = $('#request-type');
const detailsInput = $('#request-details');
let dialogTrigger;
function restoreFocus(trigger) {
  if (document.querySelector('dialog[open]')) return;
  const target = trigger?.isConnected && trigger.getClientRects().length && !trigger.closest('[hidden], [inert]')
    ? trigger : $('.command-trigger');
  target?.focus({ preventScroll: true });
}
function getRequestText() {
  const details = detailsInput.value.trim();
  return `Привет, Роман! Пишу с твоего сайта.\nИнтересует: ${typeInput.value}.${details ? `\n\n${details}` : '\nРасскажи, пожалуйста, о возможностях и условиях.'}`;
}
const briefTemplates = {
  'Разработка': 'Что нужно создать:\nДля кого:\nОсновные функции:\nЖелаемые сроки:',
  'Аккаунты': 'Сервис или платформа:\nРегион:\nДля чего нужен доступ:\nВажные условия:',
  'Ключи': 'Продукт и версия:\nУстройство или система:\nРегион активации:\nКоличество:',
  'Продвижение / накрутка': 'Площадка:\nЦель:\nФормат продвижения:\nОграничения и пожелания:'
};
const briefGuidance = {
  'Разработка': 'Что должно получиться и для кого?',
  'Аккаунты': 'Укажи сервис и регион. Не присылай пароль.',
  'Ключи': 'Название продукта, версия и регион активации.',
  'Продвижение / накрутка': 'Площадка, цель и допустимые форматы.'
};
function updatePreview() {
  $('#request-preview').textContent = getRequestText();
  $('#brief-count').textContent = `${detailsInput.value.length} / 1500`;
  $('#brief-guidance').textContent = briefGuidance[typeInput.value];
  // Never overwrite an existing visitor's draft.
  $('#brief-template').disabled = detailsInput.value.trim().length > 0;
}
$('#brief-template').addEventListener('click', () => {
  if (detailsInput.value.trim()) return;
  detailsInput.value = briefTemplates[typeInput.value];
  updatePreview();
  detailsInput.focus();
  const firstLine = detailsInput.value.indexOf('\n');
  detailsInput.setSelectionRange(firstLine, firstLine);
});
$('#brief-download').addEventListener('click', () => {
  const file = new Blob(['\uFEFF' + getRequestText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Заявка-Роману.txt';
  dialog.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});
function openRequest(type, trigger) {
  if (dialog.open) return;
  closeMenu();
  dialogTrigger = trigger;
  typeInput.value = type;
  $('#submit-note').textContent = 'Скопируй текст, открой Telegram и отправь его Роману.';
  updatePreview();
  dialog.showModal();
  document.body.classList.add('dialog-open');
  typeInput.focus({ preventScroll: true });
}
$$('[data-request]').forEach(button => button.addEventListener('click', () => openRequest(button.dataset.request, button)));
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.classList.toggle('dialog-open', !!document.querySelector('dialog[open]'));
  restoreFocus(dialogTrigger);
});
typeInput.addEventListener('change', () => {
  updatePreview();
  $('#submit-note').textContent = 'Скопируй обновлённый текст, открой Telegram и отправь его Роману.';
});
detailsInput.addEventListener('input', () => {
  updatePreview();
  $('#submit-note').textContent = 'Скопируй текст, открой Telegram и отправь его Роману.';
});
$('#request-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('.submit-request');
  button.disabled = true;
  const copied = await copyText(getRequestText(), dialog);
  $('#submit-note').textContent = copied
    ? 'Заявка скопирована. Теперь открой Telegram, вставь текст и отправь Роману.'
    : 'Не удалось скопировать автоматически. Выдели текст заявки выше и скопируй вручную.';
  if (!copied) {
    const range = document.createRange();
    range.selectNodeContents($('#request-preview'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  button.disabled = false;
});
updatePreview();

// Material presets also work with the SVG fallback; no external assets required.
function setMaterial(material) {
  if (!['lime', 'chrome', 'ember'].includes(material)) return false;
  $('#hero-art').dataset.material = material;
  $$('[data-material]').forEach(button => {
    const selected = button.dataset.material === material;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.dispatchEvent(new CustomEvent('materialchange', { detail: { material } }));
  return true;
}
$$('[data-material]').forEach(button => button.addEventListener('click', () => setMaterial(button.dataset.material)));
setMaterial('lime');
if (window.matchMedia('(pointer: coarse)').matches) $('#core-hint').textContent = 'ВЫБЕРИ СВОЙ МАТЕРИАЛ';

// Tactile card lighting: one frame per pointer update, disabled on touch/reduced motion.
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
cards.forEach(card => {
  let pendingFrame = 0, pointer = null;
  function resetCard() {
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    pointer = null;
    for (const name of ['--tilt-x', '--tilt-y', '--spot-x', '--spot-y']) card.style.removeProperty(name);
  }
  card.addEventListener('pointermove', event => {
    if (!finePointer.matches || effectsPaused) return;
    pointer = [event.clientX, event.clientY];
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      if (!pointer || effectsPaused) return;
      const rect = card.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (pointer[0] - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (pointer[1] - rect.top) / rect.height));
      card.style.setProperty('--spot-x', `${x * 100}%`);
      card.style.setProperty('--spot-y', `${y * 100}%`);
      card.style.setProperty('--tilt-x', `${(0.5 - y) * 5}deg`);
      card.style.setProperty('--tilt-y', `${(x - 0.5) * 5}deg`);
    });
  }, { passive: true });
  card.addEventListener('pointerleave', resetCard);
  document.addEventListener('effectschange', resetCard);
});

// Searchable command surface. Native dialog supplies the modal focus boundary.
const commandDialog = $('#command-dialog');
const commandInput = $('#command-search');
const commandResults = $('#command-results');
const commandCatalog = [
  { title: 'К началу', subtitle: 'Первый экран и цифровое ядро', icon: 'R.', keywords: 'домой home начало', target: 'main' },
  { title: 'О Романе', subtitle: 'Кто за этим стоит', icon: '01', keywords: 'обо мне кто роман about', target: 'about' },
  { title: 'Все направления', subtitle: 'Разработка и цифровые товары', icon: '02', keywords: 'услуги товары каталог services', target: 'services' },
  { title: 'Обсудить разработку', subtitle: 'Открыть короткий бриф', icon: '</>', keywords: 'разработка код проект сайт dev', request: 'Разработка' },
  { title: 'Подобрать аккаунт', subtitle: 'Указать сервис и регион', icon: '@', keywords: 'аккаунт аккаунты account', request: 'Аккаунты' },
  { title: 'Найти ключ', subtitle: 'Уточнить продукт и активацию', icon: '#', keywords: 'ключ ключи лицензия keys', request: 'Ключи' },
  { title: 'Обсудить продвижение', subtitle: 'Площадка, цель и ограничения', icon: '↗', keywords: 'продвижение накрутка охват', request: 'Продвижение / накрутка' },
  { title: 'Открыть терминал', subtitle: 'Интерактивный режим знакомства', icon: '>_', keywords: 'терминал playground консоль terminal', target: 'playground' },
  { title: 'Контакт', subtitle: '@no_i_lord в Telegram', icon: '↗', keywords: 'написать связь телеграм telegram контакт', target: 'contact' },
  { title: 'Переключить эффекты', subtitle: 'Пауза или продолжение анимации', icon: 'Ⅱ', keywords: 'эффекты пауза анимация motion', effect: true }
];
let selectedCommand = 0, visibleCommands = [], commandTrigger = null, pendingCommand = null;
function selectCommand(index, focus = false) {
  const buttons = $$('.command-item', commandResults);
  if (!buttons.length) return;
  selectedCommand = (index + buttons.length) % buttons.length;
  buttons.forEach((button, i) => button.classList.toggle('is-selected', i === selectedCommand));
  if (focus) buttons[selectedCommand].focus({ preventScroll: true });
  buttons[selectedCommand].scrollIntoView({ block: 'nearest', behavior: 'instant' });
}
function chooseCommand(command) {
  pendingCommand = command;
  commandDialog.close();
}
function renderCommands() {
  const query = commandInput.value.trim().toLocaleLowerCase('ru');
  const terms = query.split(/\s+/).filter(Boolean);
  visibleCommands = commandCatalog.filter(item => terms.every(term => `${item.title} ${item.subtitle} ${item.keywords}`.toLocaleLowerCase('ru').includes(term)));
  commandResults.replaceChildren();
  visibleCommands.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'command-item';
    const icon = document.createElement('span');
    icon.className = 'command-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;
    const copy = document.createElement('span');
    copy.className = 'command-item-copy';
    copy.textContent = item.title;
    const hint = document.createElement('small');
    hint.textContent = item.subtitle;
    copy.appendChild(hint);
    const arrow = document.createElement('span');
    arrow.className = 'command-item-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↵';
    button.append(icon, copy, arrow);
    button.addEventListener('click', () => chooseCommand(item));
    button.addEventListener('focus', () => selectCommand(index));
    commandResults.appendChild(button);
  });
  $('#command-empty').hidden = visibleCommands.length !== 0;
  $('#command-count').textContent = `Найдено команд: ${visibleCommands.length}.`;
  selectCommand(0);
}
function openCommands(trigger = document.activeElement) {
  if (dialog.open || commandDialog.open) return;
  closeMenu();
  commandTrigger = trigger;
  pendingCommand = null;
  commandInput.value = '';
  commandDialog.showModal();
  document.body.classList.add('dialog-open');
  renderCommands();
  commandInput.focus({ preventScroll: true });
}
$$('[data-open-commands]').forEach(button => button.addEventListener('click', () => openCommands(button)));
$('#command-close').addEventListener('click', () => commandDialog.close());
commandInput.addEventListener('input', renderCommands);
commandDialog.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    commandDialog.close();
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = document.activeElement === commandInput
      ? (event.key === 'ArrowDown' ? 0 : visibleCommands.length - 1)
      : selectedCommand + (event.key === 'ArrowDown' ? 1 : -1);
    selectCommand(next, true);
  }
  if (event.key === 'Enter' && document.activeElement === commandInput) {
    event.preventDefault();
    if (visibleCommands.length) chooseCommand(visibleCommands[selectedCommand]);
  }
});
commandDialog.addEventListener('click', event => {
  if (event.target !== commandDialog) return;
  const rect = commandDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) commandDialog.close();
});
commandDialog.addEventListener('close', () => {
  document.body.classList.toggle('dialog-open', !!document.querySelector('dialog[open]'));
  restoreFocus(commandTrigger);
  const command = pendingCommand;
  pendingCommand = null;
  if (!command) return;
  if (command.request) openRequest(command.request, commandTrigger);
  else if (command.effect) setEffectsPaused(!effectsPaused);
  else if (command.target) {
    const target = document.getElementById(command.target);
    target.scrollIntoView({ behavior: effectsPaused ? 'instant' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK' && !event.isComposing) {
    event.preventDefault();
    if (commandDialog.open) commandDialog.close();
    else openCommands();
  }
});

// A safe local terminal: allowlisted UI commands only, never evaluates code or runs a shell.
const terminalInput = $('#terminal-input');
const terminalOutput = $('#terminal-output');
const terminalHistory = [];
const terminalVocabulary = ['help', 'whoami', 'services', 'contact', 'clear', 'secret', 'theme lime', 'theme chrome', 'theme ember'];
let historyIndex = 0, terminalDraft = '';
function printTerminal(command, response) {
  const entry = document.createElement('div');
  entry.className = 'terminal-entry';
  const prompt = document.createElement('p');
  prompt.className = 'terminal-command';
  prompt.textContent = 'roman@digital ~ ';
  const userText = document.createElement('span');
  userText.textContent = command;
  prompt.appendChild(userText);
  const output = document.createElement('p');
  output.className = 'terminal-response';
  output.textContent = response;
  entry.append(prompt, output);
  terminalOutput.appendChild(entry);
  while (terminalOutput.children.length > 35) terminalOutput.firstElementChild.remove();
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
function runTerminal(raw) {
  const command = raw.trim().slice(0, 120);
  if (!command) return;
  terminalHistory.push(command);
  if (terminalHistory.length > 30) terminalHistory.shift();
  historyIndex = terminalHistory.length;
  terminalDraft = '';
  const normalized = command.toLowerCase().replace(/\s+/g, ' ');
  if (normalized === 'clear') { terminalOutput.replaceChildren(); return; }
  let response;
  switch (normalized) {
    case 'help':
      response = 'whoami      — познакомиться с Романом\nservices    — направления работы\ncontact     — контакт в Telegram\ntheme lime  — лаймовое ядро\ntheme chrome / theme ember — другие материалы\nsecret      — маленькая пасхалка\nclear       — очистить экран\n\n↑ ↓ история · Tab дополнить · Ctrl+K быстрый переход';
      break;
    case 'whoami':
      response = 'Роман / @no_i_lord\nПрограммист и ресейлер цифровых товаров.\nСоздаю решения и помогаю с цифровым доступом.\nБез цепочки менеджеров — общаемся лично.';
      break;
    case 'services':
      response = '01  Разработка\n02  Аккаунты\n03  Цифровые ключи\n04  Продвижение / накрутка\n\nНаличие, стоимость и условия — по запросу.\nCtrl+K → выбери направление → заполни бриф.';
      break;
    case 'contact':
      response = 'Telegram: @no_i_lord\nКнопка «Контакт» в нижней панели ведёт к ссылке.\nНичего не отправляю автоматически — решение за тобой.';
      break;
    case 'secret': {
      const active = document.body.classList.toggle('secret-mode');
      response = active ? '[ СКРЫТЫЙ СЛОЙ ОТКРЫТ ]\nХороший код не шумит. Он просто работает.\nТы нашёл пасхалку. Добро пожаловать внутрь.\nПовтори secret, чтобы вернуться.' : 'Скрытый слой закрыт. Обычный режим восстановлен.';
      break;
    }
    default: {
      const match = /^theme (lime|chrome|ember)$/.exec(normalized);
      if (match) {
        setMaterial(match[1]);
        const names = { lime: 'лайм', chrome: 'хром', ember: 'янтарь' };
        response = `Материал ядра: ${names[match[1]]}.\nПосмотри на первый экран — материал уже изменён.`;
      } else response = 'Такой команды нет. Введи help.\nЭто интерфейс сайта, не системная консоль.';
    }
  }
  printTerminal(command, response);
}
$('#terminal-form').addEventListener('submit', event => {
  event.preventDefault();
  runTerminal(terminalInput.value);
  terminalInput.value = '';
});
$('#terminal-clear').addEventListener('click', () => { terminalOutput.replaceChildren(); terminalInput.focus(); });
$$('[data-terminal-command]').forEach(button => button.addEventListener('click', () => runTerminal(button.dataset.terminalCommand)));
terminalInput.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (!terminalHistory.length) return;
    event.preventDefault();
    if (historyIndex === terminalHistory.length) terminalDraft = terminalInput.value;
    historyIndex = Math.max(0, Math.min(terminalHistory.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
    terminalInput.value = historyIndex === terminalHistory.length ? terminalDraft : terminalHistory[historyIndex];
    terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
  }
  if (event.key === 'Tab' && !event.shiftKey && terminalInput.value.trim()) {
    const prefix = terminalInput.value.trim().toLowerCase();
    const matches = terminalVocabulary.filter(command => command.startsWith(prefix));
    if (matches.length === 1 && matches[0] !== prefix) {
      event.preventDefault();
      terminalInput.value = matches[0];
    }
  }
});
$('#quick-dock').addEventListener('focusout', () => requestAnimationFrame(updateProgress));

// Original procedural sculpture. WebGL 1, no models, textures or CDN dependencies.
(function createDigitalCore() {
  const canvas = $('#core-canvas');
  const art = $('#hero-art');
  const toggle = $('#motion-toggle');
  let gl;
  try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { gl = null; }
  if (!gl) { canvas.hidden = true; toggle.hidden = true; return; }

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat3 uRotation;
    uniform mat4 uProjection;
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vec3 p = uRotation * aPosition;
      vPosition = p;
      vNormal = normalize(uRotation * aNormal);
      gl_Position = uProjection * vec4(p - vec3(0.0, 0.0, 9.4), 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform float uMaterial;
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vec3(0.0, 0.0, 9.4) - vPosition);
      vec3 R = reflect(-V, N);
      vec3 light = normalize(vec3(-2.5, 4.0, 5.0));
      float diffuse = max(dot(N, light), 0.0);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.8);
      float top = smoothstep(-0.15, 0.85, R.y);
      float strip = pow(max(0.0, 1.0 - abs(R.x * 0.6 + R.y * 0.75 - 0.22)), 28.0);
      float strip2 = pow(max(0.0, 1.0 - abs(R.x * 0.88 - R.y * 0.38 + 0.65)), 48.0);
      float spec = pow(max(dot(reflect(-light, N), V), 0.0), 75.0);
      float bands = 0.5 + 0.5 * sin(R.y * 6.0 + R.x * 2.0);
      vec3 dark = vec3(0.075, 0.10, 0.041);
      vec3 green = vec3(0.43, 0.59, 0.22);
      vec3 chrome = vec3(0.86, 0.96, 0.69);
      vec3 color = mix(dark, green, diffuse * 0.57 + top * 0.38);
      color += chrome * strip * 0.91;
      color += vec3(0.65, 0.94, 0.25) * strip2 * 0.62;
      color += chrome * spec * 0.68;
      color += vec3(0.49, 0.65, 0.27) * rim * 0.43;
      color *= 0.78 + bands * 0.25;
      color += vec3(0.065, 0.075, 0.04);
      color = pow(color, vec3(0.87));
      float luminance = dot(color, vec3(0.299, 0.587, 0.114));
      if (uMaterial > 0.5 && uMaterial < 1.5) color = vec3(luminance * 0.96, luminance * 1.05, luminance * 1.18);
      if (uMaterial > 1.5) color = vec3(color.g * 1.18, color.g * 0.68 + color.r * 0.18, color.b * 0.48);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error('Недоступна аппаратная визуализация ядра');
    }
    return shader;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL link failed');
    gl.useProgram(program);
  } catch {
    canvas.hidden = true;
    toggle.hidden = true;
    return;
  }

  const normalize = a => { const length = Math.hypot(...a) || 1; return a.map(v => v / length); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const center = t => {
    const r = 1.37 + 0.48 * Math.cos(3 * t);
    return [r * Math.cos(2 * t), r * Math.sin(2 * t), 0.69 * Math.sin(3 * t)];
  };
  const positions = [], normals = [], indices = [];
  const segments = 224, sides = 32, tube = 0.40;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments * Math.PI * 2;
    const p = center(t), next = center(t + 0.001);
    const tangent = normalize(next.map((v, k) => v - p[k]));
    const side = normalize(cross(tangent, [0, 0, 1]));
    const up = normalize(cross(side, tangent));
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const n = side.map((v, k) => v * Math.cos(a) + up[k] * Math.sin(a));
      positions.push(...p.map((v, k) => v + n[k] * tube));
      normals.push(...n);
      if (i < segments && j < sides) {
        const c = i * (sides + 1) + j;
        indices.push(c, c + sides + 1, c + 1, c + 1, c + sides + 1, c + sides + 2);
      }
    }
  }
  function attribute(name, values) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  }
  attribute('aPosition', positions);
  attribute('aNormal', normals);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  const rotationUniform = gl.getUniformLocation(program, 'uRotation');
  const projectionUniform = gl.getUniformLocation(program, 'uProjection');
  const materialUniform = gl.getUniformLocation(program, 'uMaterial');
  gl.uniform1f(materialUniform, 0);

  function multiply(a, b) {
    const result = new Float32Array(9);
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 3; k++) result[col * 3 + row] += a[k * 3 + row] * b[col * 3 + k];
    }
    return result;
  }
  function rotation(x, y, z) {
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    return multiply(multiply([cz, sz, 0, -sz, cz, 0, 0, 0, 1], [cy, 0, -sy, 0, 1, 0, sy, 0, cy]), [1, 0, 0, 0, cx, sx, 0, -sx, cx]);
  }
  let angle = 0, corePaused = false, pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let visible = true, contextLost = false, raf = 0, lastTime = 0;
  const isPaused = () => corePaused || effectsPaused;
  function updateToggle() {
    const paused = isPaused();
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-disabled', String(effectsPaused));
    const label = effectsPaused ? 'Анимация остановлена общей настройкой эффектов'
      : paused ? 'Включить анимацию ядра' : 'Остановить анимацию ядра';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
  }
  function resize() {
    const rect = art.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    const aspect = width / height, f = 1 / Math.tan(0.64 / 2), near = 0.1, far = 50;
    // Wider field of view on narrow cards keeps the sculpture fully inside its frame.
    const adjustedF = aspect < 0.85 ? f * aspect / 0.85 : f;
    gl.uniformMatrix4fv(projectionUniform, false, new Float32Array([
      adjustedF / aspect, 0, 0, 0, 0, adjustedF, 0, 0,
      0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0
    ]));
    draw();
  }
  function draw() {
    if (contextLost) return;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix3fv(rotationUniform, false, rotation(0.44 + smoothY * 0.22, angle + smoothX * 0.28, -0.25));
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }
  function frame(time) {
    raf = 0;
    if (isPaused() || !visible || document.hidden || contextLost) { lastTime = 0; return; }
    const delta = lastTime ? Math.min(time - lastTime, 50) / 1000 : 0;
    lastTime = time;
    angle += delta * 0.16;
    smoothX += (pointerX - smoothX) * 0.06;
    smoothY += (pointerY - smoothY) * 0.06;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function resume() {
    if (isPaused() || !visible || document.hidden || contextLost) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  art.addEventListener('pointermove', event => {
    if (isPaused() || event.pointerType === 'touch') return;
    const rect = art.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }, { passive: true });
  art.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  toggle.addEventListener('click', () => {
    if (effectsPaused) {
      showToast(motionPreference.matches ? 'Движение отключено в настройках системы.' : 'Сначала включи общие эффекты в нижней панели или через Ctrl+K.');
      return;
    }
    corePaused = !corePaused;
    updateToggle();
    resume();
  });
  document.addEventListener('effectschange', () => {
    // Freeze at the current pose; global pause does not erase the local choice.
    pointerX = 0;
    pointerY = 0;
    updateToggle();
    resume();
  });
  document.addEventListener('materialchange', event => {
    if (contextLost) return;
    const materials = { lime: 0, chrome: 1, ember: 2 };
    gl.uniform1f(materialUniform, materials[event.detail.material] ?? 0);
    draw();
  });
  document.addEventListener('visibilitychange', resume);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); }).observe(art);
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(art);
  else window.addEventListener('resize', resize, { passive: true });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    if (raf) cancelAnimationFrame(raf);
    art.classList.remove('webgl-ready');
    canvas.hidden = true;
    toggle.hidden = true;
  });
  resize();
  art.classList.add('webgl-ready');
  updateToggle();
  resume();
})();
