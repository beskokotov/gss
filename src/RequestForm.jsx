import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { contacts } from './content.js';

const endpoint = import.meta.env.VITE_REQUEST_ENDPOINT || `${import.meta.env.BASE_URL}api/request.php`;
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const messages = {
  RATE_LIMITED: 'Слишком много попыток. Попробуйте позже или свяжитесь с нами по телефону.',
  INVALID_INPUT: 'Проверьте имя и контакт для ответа, затем попробуйте ещё раз.',
  INVALID_TOKEN: 'Не удалось подтвердить отправку. Попробуйте ещё раз.'
};

export default function RequestForm({ topic }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const form = useRef(null);
  const pending = useRef(false);
  const controller = useRef(null);
  const requestId = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function send(event) {
    event.preventDefault();
    if (pending.current) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const contact = values.contact.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const isPhone = /^\+?[\d\s().-]+$/.test(contact) && contact.replace(/\D/g, '').length >= 7 && contact.replace(/\D/g, '').length <= 15;
    if (!isEmail && !isPhone) {
      const input = form.current.elements.contact;
      input.setCustomValidity('Укажите телефон с кодом города или электронную почту.');
      input.reportValidity();
      return;
    }
    pending.current = true;
    setStatus('sending');
    setError('');
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current?.abort(), 35000);
    try {
      if (!['http:', 'https:'].includes(window.location.protocol)) throw new Error('UNAVAILABLE');
      const options = { signal: controller.current.signal, credentials: 'same-origin', cache: 'no-store' };
      const tokenResponse = await fetch(endpoint, { ...options, headers: { Accept: 'application/json' } });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token.token) throw new Error(token.code || 'UNAVAILABLE');
      requestId.current ||= newId();
      const response = await fetch(endpoint, {
        ...options,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...values, contact, topic, token: token.token, requestId: requestId.current })
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.code || 'UNAVAILABLE');
      form.current?.reset();
      setStatus('success');
    } catch (reason) {
      if (!form.current) return;
      setError(messages[reason.message] || 'Не удалось подтвердить отправку заявки. Попробуйте ещё раз или свяжитесь с нами напрямую.');
      setStatus('error');
    } finally {
      clearTimeout(timer);
      pending.current = false;
    }
  }

  if (status === 'success') return <div className="request-success" role="status">
    <span className="request-success-icon" aria-hidden="true"><Icon name="check" size={24} /></span>
    <h3>Заявка отправлена</h3>
    <p>Ваша заявка отправлена на {contacts.email}. Наша команда свяжется с вами по указанному контакту.</p>
    <button type="button" className="text-button" onClick={() => { requestId.current = null; setStatus('idle'); }}>Отправить ещё одну заявку</button>
  </div>;

  return <>
    <p className="muted">Расскажите о задаче и оставьте контакт для ответа. Заявка поступит нашей команде.</p>
    <form ref={form} onSubmit={send} aria-busy={status === 'sending'} onChange={() => { if (!pending.current) { requestId.current = null; setError(''); setStatus('idle'); } }}>
      <fieldset className="request-fields" disabled={status === 'sending'}>
        <label>Как к вам обращаться<input name="name" autoComplete="name" required maxLength="80" placeholder="Ваше имя" pattern=".*\S.*" /></label>
        <label>Телефон или электронная почта<input name="contact" autoComplete="email" required maxLength="120" placeholder="Для ответа на ваш вопрос" onInput={event => event.currentTarget.setCustomValidity('')} /></label>
        <label>Ваша задача<textarea name="message" rows="3" maxLength="1200" placeholder="Профессия, нужные материалы, удобный формат знакомства" /></label>
        <div className="request-honeypot" aria-hidden="true"><label>Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      </fieldset>
      <p className="form-note">Нажимая «Отправить заявку», вы передаёте имя, контакт и текст обращения команде «Гарант-Сервис Самара» для ответа на ваш запрос.</p>
      {error && <div className="request-error" role="alert"><p>{error}</p><a href={contacts.phones[0].href}>{contacts.phones[0].label}</a><a href={`mailto:${contacts.email}`}>{contacts.email}</a></div>}
      <button className="button" type="submit" disabled={status === 'sending'}>{status === 'sending' ? <><span className="request-spinner" aria-hidden="true" /> Отправляем…</> : <>Отправить заявку <Icon name="arrow" size={20} /></>}</button>
      <span className="sr-only" role="status">{status === 'sending' ? 'Отправляем заявку. Дождитесь подтверждения.' : ''}</span>
    </form>
  </>;
}
