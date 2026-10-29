import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { makeMailto } from './content.js';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Ключевые сценарии сайта', () => {
  it('связывает все внутренние ссылки с существующими разделами', () => {
    render(<App />);
    for (const link of document.querySelectorAll('a[href^="#"]')) {
      expect(document.getElementById(link.getAttribute('href').slice(1))).not.toBeNull();
    }
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('открывает меню, закрывает по навигации и Escape', async () => {
    const user = userEvent.setup(); render(<App />);
    const toggle = screen.getByRole('button', { name: 'Открыть меню' });
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Контакты' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle); await user.keyboard('{Escape}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('переключает 17 продуктов мышью и клавиатурой, сохраняя общее описание', async () => {
    const user = userEvent.setup(); render(<App />);
    expect(screen.getAllByRole('tab')).toHaveLength(17);
    const initialDescription = screen.getByRole('tabpanel').textContent;
    await user.click(screen.getByRole('tab', { name: 'Продукт 3' }));
    expect(screen.getByRole('tabpanel').textContent).toBe(initialDescription);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Продукт 4' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Продукт 17' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Продукт 17' }));
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('tab-product-17');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Продукт 1' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Продукт 17' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Продукт 1' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Продукт 2' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe(initialDescription);
  });

  it('готовит письмо с выбранным направлением и не отправляет запрос на сервер', async () => {
    const user = userEvent.setup(); const fetchSpy = vi.spyOn(globalThis, 'fetch'); render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Продукт 3' }));
    await user.click(screen.getByRole('button', { name: 'Подобрать комплект' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Как к вам обращаться'), 'Анна');
    await user.type(within(dialog).getByLabelText('Телефон или электронная почта'), 'anna@example.com');
    await user.type(within(dialog).getByLabelText('Ваша задача'), 'Нужны договоры и судебная практика');
    await user.click(within(dialog).getByRole('button', { name: 'Подготовить письмо' }));
    const href = within(dialog).getByRole('link', { name: 'Открыть письмо' }).getAttribute('href');
    expect(decodeURIComponent(href)).toContain('Подбор системы: продукт 3');
    expect(decodeURIComponent(href)).toContain('Анна');
    expect(href.startsWith('mailto:info@gss.ru?')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Как к вам обращаться'), ' П.');
    expect(within(dialog).queryByRole('link', { name: 'Открыть письмо' })).toBeNull();
  });

  it('открывает материал, закрывает окно и возвращает фокус', async () => {
    const user = userEvent.setup(); render(<App />);
    const opener = screen.getByRole('button', { name: 'Что посмотреть на демонстрации' });
    await user.click(opener);
    expect(screen.getByRole('dialog').textContent).toContain('Подготовьте один типичный вопрос');
    await user.click(screen.getByRole('button', { name: 'Закрыть окно' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
  });

  it('обрабатывает отмену диалога и отсутствие доступа к буферу', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Заказать демонстрацию' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Скопировать адрес' }));
    expect(screen.getByText('Выделите и скопируйте адрес выше')).not.toBeNull();
  });

  it('дает приостановить и возобновить анимацию', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Приостановить анимацию' }));
    expect(document.querySelector('.site').dataset.motion).toBe('off');
    await user.click(screen.getByRole('button', { name: 'Включить анимацию' }));
    expect(document.querySelector('.site').dataset.motion).toBe('on');
  });

  it('корректно кодирует переносы и специальные символы письма', () => {
    const uri = makeMailto({ name: 'Иван & Анна', contact: '+7 900 000', message: 'Вопрос? № 1\nПродолжение', topic: 'ГАРАНТ' });
    const query = new URLSearchParams(uri.split('?')[1]);
    expect(query.get('subject')).toBe('ГАРАНТ');
    expect(query.get('body')).toContain('Иван & Анна');
    expect(query.get('body')).toContain('Вопрос? № 1\nПродолжение');
  });
});
