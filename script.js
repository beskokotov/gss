'use strict';
document.documentElement.classList.add('js');
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menuButton.hidden = false;
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width:801px)').addEventListener('change', closeMenu);
const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(tab) {
  tabs.forEach(item => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    const target = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      activateTab(tabs[target]);
      tabs[target].focus();
    }
  });
});
const dialog = document.querySelector('#request-dialog');
const form = document.querySelector('#request-form');
const status = document.querySelector('#form-status');
let opener;
document.querySelectorAll('[data-request]').forEach(button => {
  button.addEventListener('click', () => {
    opener = button;
    closeMenu();
    form.elements.topic.value = button.dataset.request;
    status.textContent = '';
    dialog.showModal();
    document.body.classList.add('modal-open');
  });
});
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  opener?.focus();
});
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
for (const field of [form.elements.name, form.elements.message]) {
  field.addEventListener('input', () => field.setCustomValidity(''));
}
form.addEventListener('input', () => {
  status.textContent = '';
});
form.addEventListener('submit', event => {
  event.preventDefault();
  for (const field of [form.elements.name, form.elements.message]) {
    field.setCustomValidity(field.value.trim() ? '' : 'Введите текст: одних пробелов недостаточно.');
  }
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const body = `Здравствуйте!\n\nИмя: ${data.get('name').trim()}\nEmail для ответа: ${data.get('email').trim()}\n\n${data.get('message').trim()}`;
  const link = document.createElement('a');
  link.href = `mailto:info@gss.ru?subject=${encodeURIComponent(data.get('topic'))}&body=${encodeURIComponent(body)}`;
  document.body.append(link);
  link.click();
  link.remove();
  status.textContent = 'Запрошено открытие почтового приложения. Письмо ещё не отправлено — подтвердите отправку в нём. Если приложение не открылось, напишите на info@gss.ru напрямую.';
});
