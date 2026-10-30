import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { products } from './content.js';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Ключевые сценарии сайта', () => {
  it('открывает описание системы в окне и возвращает фокус к кнопке после закрытия', async () => {
    const user = userEvent.setup(); render(<App />);
    const button = screen.getByRole('button', { name: 'О системе', exact: true });
    expect(screen.queryByRole('link', { name: 'О системе', exact: true })).toBeNull();
    await user.click(button);
    const dialog = screen.getByRole('dialog', { name: 'О системе ГАРАНТ' });
    expect(within(dialog).getByRole('heading', { name: 'Что предлагает система ГАРАНТ' })).not.toBeNull();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(6);
    await user.click(within(dialog).getByRole('button', { name: 'Закрыть окно' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

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

  it('выбирает продукты мышью и клавиатурой и возвращает описание', async () => {
    const user = userEvent.setup(); render(<App />);
    const group = screen.getByRole('tablist', { name: 'Продукты ГАРАНТ' });
    expect(within(group).getAllByRole('tab')).toHaveLength(17);
    for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9, 17]) {
      const tab = within(group).getByRole('tab', { name: products[number - 1].label });
      await user.click(tab);
      expect(tab.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(`tab-product-${number}`);
      const descriptions = { 1: 'AI-ассистент', 2: 'Интеллектуальный подбор и анализ судебной практики', 3: 'Автоматизация составления документов', 4: 'Комплексная информация о контрагентах', 5: 'Автоматизация поиска и участия в госзакупках', 6: 'Создание облачного информационного банка внутренних документов вашей организации', 7: 'Автоматизация поиска, получения, размещения и обновления нормативно-правовых актов', 8: 'Создание и управление портфелем товарных знаков и патентов' };
      expect(screen.getByRole('tabpanel').textContent).toContain(number === 9 ? 'Автоматизация процесса согласования и утверждения документов' : descriptions[number] ?? 'Онлайн-сопровождение выпуска нового сертификата действующей электронной подписи');
      expect(within(screen.getByRole('tabpanel')).queryByRole('button')).toBeNull();
    }
    within(group).getByRole('tab', { name: products[16].label }).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(within(group).getByRole('tab', { name: products[0].label }));
    await user.keyboard('{End}');
    expect(within(group).getByRole('tab', { name: products[16].label }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}{ArrowRight}');
    expect(within(group).getByRole('tab', { name: products[1].label }).getAttribute('aria-selected')).toBe('true');
  });

  it('отправляет заявку через сервер и показывает подтверждение только после ответа', async () => {
    const user = userEvent.setup();
    let resolveDelivery;
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'test-token' }) })
      .mockImplementationOnce(() => new Promise(resolve => { resolveDelivery = resolve; }));
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Получить консультацию' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Как к вам обращаться'), 'Анна');
    await user.type(within(dialog).getByLabelText('Телефон или электронная почта'), 'anna@example.com');
    await user.type(within(dialog).getByLabelText('Ваша задача'), 'Нужны договоры и судебная практика');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить заявку' }));
    expect(within(dialog).getByRole('button', { name: 'Отправляем…' }).disabled).toBe(true);
    expect(within(dialog).queryByText('Заявка отправлена')).toBeNull();
    const payload = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(payload.topic).toBe('Консультация по системе ГАРАНТ');
    expect(payload.name).toBe('Анна');
    expect(payload.token).toBe('test-token');
    expect(payload.requestId).toBeTruthy();
    expect(fetchSpy.mock.calls[1][1].method).toBe('POST');
    await act(async () => resolveDelivery({ ok: true, json: async () => ({ ok: true }) }));
    expect(within(dialog).getByText('Заявка отправлена')).not.toBeNull();
    expect(within(dialog).queryByRole('link', { name: 'Открыть письмо' })).toBeNull();
  });

  it('сохраняет текст при ошибке и не показывает ложное подтверждение', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'test-token' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ code: 'UNAVAILABLE' }) });
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Получить консультацию' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Как к вам обращаться'), 'Анна');
    await user.type(within(dialog).getByLabelText('Телефон или электронная почта'), 'anna@example.com');
    await user.type(within(dialog).getByLabelText('Ваша задача'), 'Нужна консультация');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить заявку' }));
    expect(await within(dialog).findByRole('alert')).not.toBeNull();
    expect(within(dialog).getByLabelText('Ваша задача').value).toBe('Нужна консультация');
    expect(within(dialog).getByLabelText('Телефон или электронная почта').value).toBe('anna@example.com');
    expect(within(dialog).queryByText('Заявка отправлена')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Отправить заявку' }).disabled).toBe(false);
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
    await user.click(within(screen.getByRole('region', { name: /Давайте найдем/ })).getByRole('button', { name: 'Заказать демонстрацию' }));
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

});
