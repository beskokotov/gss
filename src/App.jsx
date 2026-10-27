import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { contacts, navigation, professions, services, materials, questions, makeMailto } from './content.js';

const asset = (name) => `${import.meta.env.BASE_URL}assets/${name}`;

function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  const previous = useRef(document.activeElement);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.showModal();
    return () => {
      document.body.style.overflow = overflow;
      previous.current?.focus();
    };
  }, []);
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title"
    onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-body">
      <button className="icon-button dialog-close" aria-label="Закрыть окно" onClick={onClose} autoFocus><Icon name="close" /></button>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </div>
  </dialog>;
}

function RequestForm({ topic }) {
  const [draft, setDraft] = useState(null);
  const [copied, setCopied] = useState('');
  function prepare(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setDraft({ ...values, topic });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Тема: ${draft.topic}\nИмя: ${draft.name}\nКонтакт: ${draft.contact}\n\n${draft.message}`);
      setCopied('Текст письма скопирован.');
    } catch { setCopied('Выделите и скопируйте текст из поля выше.'); }
  }
  return <>
    <p className="muted">Расскажите о задаче. Подготовим письмо для региональной команды.</p>
    <form onSubmit={prepare} onChange={() => { setDraft(null); setCopied(''); }}>
      <label>Как к вам обращаться<input name="name" autoComplete="name" required maxLength="80" placeholder="Ваше имя" pattern=".*\S.*" /></label>
      <label>Телефон или электронная почта<input name="contact" autoComplete="email" required maxLength="120" placeholder="Для ответа на ваш вопрос" pattern=".*\S.*" /></label>
      <label>Ваша задача<textarea name="message" rows="3" maxLength="1200" placeholder="Профессия, нужные материалы, удобный формат знакомства" /></label>
      <p className="form-note">Данные остаются в этой вкладке. Письмо отправляется вами в почтовой программе на {contacts.email}.</p>
      <button className="button" type="submit">Подготовить письмо <Icon name="arrow" size={20} /></button>
    </form>
    {draft && <div className="draft" role="status">
      <h3>Письмо готово к отправке</h3>
      <p>Откройте его в почтовой программе и нажмите «Отправить».</p>
      <textarea aria-label="Текст подготовленного письма" readOnly rows="5" value={`Тема: ${draft.topic}\nИмя: ${draft.name}\nКонтакт: ${draft.contact}\n\n${draft.message}`} />
      <div className="actions"><a className="button" href={makeMailto(draft)}>Открыть письмо <Icon name="mail" size={18} /></a><button className="text-button" onClick={copy}>Скопировать текст</button></div>
      <p className="form-note">Если почтовая программа не настроена, скопируйте текст и напишите на <a href={`mailto:${contacts.email}`}>{contacts.email}</a>.</p>
      <span aria-live="polite">{copied}</span>
    </div>}
  </>;
}

export default function App() {
  const [menu, setMenu] = useState(false);
  const [profession, setProfession] = useState(0);
  const [modal, setModal] = useState(null);
  const [motion, setMotion] = useState(true);
  const [copyStatus, setCopyStatus] = useState('');
  const menuButton = useRef(null);
  const current = professions[profession];
  const request = (topic = 'Демонстрация системы ГАРАНТ') => setModal({ type: 'request', title: topic });

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && menu) { setMenu(false); menuButton.current?.focus(); } };
    const onResize = () => { if (window.innerWidth > 1000) setMenu(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [menu]);

  function chooseTab(index) {
    setProfession(index);
    document.getElementById(`tab-${professions[index].id}`)?.focus();
  }
  function tabKey(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % professions.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + professions.length) % professions.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = professions.length - 1;
    if (next !== undefined) { event.preventDefault(); chooseTab(next); }
  }
  async function copyAddress() {
    try { await navigator.clipboard.writeText(`${contacts.address}, ${contacts.office}`); setCopyStatus('Адрес скопирован'); }
    catch { setCopyStatus('Выделите и скопируйте адрес выше'); }
  }

  return <div className="site" data-motion={motion ? 'on' : 'off'}>
    <a className="skip-link" href="#main">Перейти к содержанию</a>
    <div className="utility"><div className="container utility-inner">
      <span><Icon name="pin" size={14} /> Самара и Самарская область</span>
      <span className="partner-note">Региональный партнер компании «ГАРАНТ»</span>
      <a href="https://www.garant.ru/" target="_blank" rel="noreferrer">Портал ГАРАНТ.РУ <Icon name="external" size={14} /><span className="sr-only"> (новая вкладка)</span></a>
    </div></div>

    <header className="header">
      <div className="container masthead">
        <a className="brand" href="#home" aria-label="Гарант-Сервис Самара — главная">
          <img src={asset('gss-logo.png')} alt="" width="66" height="54" />
          <span>Гарант-Сервис <strong>Самара</strong></span>
        </a>
        <a className="garant-brand" href="https://www.garant.ru/" aria-label="ГАРАНТ — информационно-правовое обеспечение"><img src={asset('garant-logo.png')} alt="ГАРАНТ — информационно-правовое обеспечение" width="141" height="42" /></a>
        <a className="header-phone" href={contacts.phones[0].href}>{contacts.phones[0].label}<small>Связаться с командой</small></a>
        <button className="button button-small header-request" onClick={() => request('Консультация по системе ГАРАНТ')}>Получить консультацию</button>
        <button ref={menuButton} className="icon-button menu-toggle" aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
      </div>
      <nav id="main-navigation" className={`navigation ${menu ? 'is-open' : ''}`} aria-label="Главная навигация">
        <div className="container nav-inner">{navigation.map(([id, text]) => <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>{text}</a>)}<a className="nav-contact" href={contacts.phones[0].href}><Icon name="phone" size={16} /> Позвонить нам</a></div>
      </nav>
    </header>

    <main id="main">
      <section className="container hero-section" id="home" aria-labelledby="hero-title">
        <div className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="status-dot" /> Система ГАРАНТ в Самаре</span>
            <h1 id="hero-title">Уверенность<br />в каждом<br /><span>решении.</span></h1>
            <p>Правовая информация и экспертная поддержка — чтобы вы могли сосредоточиться на главном.</p>
            <div className="actions"><button className="button" onClick={() => request()}>Познакомиться с системой <Icon name="arrow" size={20} /></button><a className="text-button" href="#system">Что умеет ГАРАНТ <Icon name="arrow" size={18} /></a></div>
            <span className="hero-caption">Для бизнеса, специалистов и организаций</span>
          </div>
          <div className="hero-visual" aria-hidden="true"><img className="hero-art" src={asset('legal-art.webp')} width="1536" height="1024" fetchPriority="high" alt="" /><div className="floating-note"><span className="mini-check"><Icon name="check" size={17} /></span><span>Правовая основа<br /><strong>для ваших задач</strong></span></div></div>
          <button className="motion-toggle" aria-pressed={!motion} onClick={() => setMotion(!motion)}>{motion ? 'Приостановить анимацию' : 'Включить анимацию'}</button>
        </div>
        <div className="quick-links">{[
          ['document', 'Найти правовую основу', 'system'], ['layers', 'Подобрать решение', 'solutions'], ['chat', 'Получить поддержку', 'services'], ['pin', 'Связаться с нами', 'contacts']
        ].map(([icon, label, id]) => <a key={id} href={`#${id}`}><span className="quick-icon"><Icon name={icon} /></span>{label}<Icon name="arrow" size={18} /></a>)}</div>
      </section>

      <section className="container section" id="system" aria-labelledby="system-title">
        <div className="section-heading"><div><span className="eyebrow">Больше, чем справочник</span><h2 id="system-title">Сложные вопросы.<br />Понятные инструменты.</h2></div><p>Электронно-периодический справочник системы ГАРАНТ: нормативные документы, практика и профессиональные материалы в едином информационном пространстве.</p></div>
        <div className="capability-grid">
          <article className="capability capability-main"><div><span className="icon-tile"><Icon name="search" size={28} /></span><h3>От вопроса<br />к нужному документу</h3><p>Поиск помогает находить правовую информацию. Связанные материалы дают контекст для работы.</p><a className="text-button" href="#solutions">Выбрать свое направление <Icon name="arrow" size={18} /></a></div><img src={asset('research-art.webp')} alt="" width="1536" height="1024" loading="lazy" /></article>
          <article className="capability lavender"><span className="icon-tile"><Icon name="document" size={28} /></span><h3>Право и практика</h3><p>Федеральное и региональное законодательство, судебная практика и комментарии.</p><span className="card-caption">С учетом выбранного наполнения</span></article>
          <article className="capability mint"><span className="icon-tile"><Icon name="layers" size={28} /></span><h3>От теории<br />к действию</h3><p>Практические ситуации, формы и образцы документов для повседневной работы.</p><span className="card-caption">Инструменты для специалистов</span></article>
        </div>
      </section>

      <section className="container section" id="solutions" aria-labelledby="solutions-title">
        <div className="section-heading"><div><span className="eyebrow">Под ваши задачи</span><h2 id="solutions-title">У каждой профессии —<br />свое решение.</h2></div><p>Выберите направление. Мы поможем подобрать информационные блоки и согласовать условия подключения.</p></div>
        <div className="tabs" role="tablist" aria-label="Решения по профессиям">{professions.map((item, index) => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={index === profession} aria-controls="profession-panel" tabIndex={index === profession ? 0 : -1} onKeyDown={(event) => tabKey(event, index)} onClick={() => setProfession(index)}><Icon name={item.icon} size={20} />{item.label}</button>)}</div>
        <div id="profession-panel" className="profession-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} tabIndex="0">
          <div className="profession-copy"><span className="pill">{current.tag}</span><h3>{current.title}</h3><p>{current.text}</p><button className="button" onClick={() => request(`Подбор системы: ${current.label.toLowerCase()}`)}>Подобрать комплект <Icon name="arrow" size={19} /></button></div>
          <div className="profession-list"><span className="eyebrow">Что обсудим при подборе</span>{current.items.map((item) => <div className="check-row" key={item}><span><Icon name="check" size={18} /></span>{item}</div>)}<p className="form-note">Точный состав комплекта и стоимость уточняются индивидуально.</p></div>
        </div>
      </section>

      <section className="service-section" id="services" aria-labelledby="services-title"><div className="container section">
        <div className="section-heading"><div><span className="eyebrow">Поддержка на каждом этапе</span><h2 id="services-title">Система. Сервисы.<br />Люди рядом.</h2></div><p>Познакомиться, освоить, разобраться в вопросе — региональная команда поможет двигаться дальше.</p></div>
        <div className="service-grid">{services.map((service) => <article className={`service-card ${service.color}`} key={service.title}><span className="icon-tile"><Icon name={service.icon} size={28} /></span><h3>{service.title}</h3><p>{service.text}</p><a className="text-button" href={service.href} target="_blank" rel="noreferrer">Об услуге <Icon name="external" size={18} /><span className="sr-only"> (новая вкладка)</span></a></article>)}</div>
        <div className="support-strip"><div><Icon name="users" size={28} /><span><strong>Уже работаете с ГАРАНТ?</strong><small>Поможем с использованием и техническими вопросами.</small></span></div><button className="text-button" onClick={() => request('Помощь пользователю системы ГАРАНТ')}>Связаться с поддержкой <Icon name="arrow" size={20} /></button></div>
      </div></section>

      <section className="container section" id="materials" aria-labelledby="materials-title"><div className="section-heading"><div><span className="eyebrow">Полезно знать</span><h2 id="materials-title">Начните с главного.</h2></div><a className="text-button" href="https://www.garant.ru/news/" target="_blank" rel="noreferrer">Правовые новости на ГАРАНТ.РУ <Icon name="external" size={18} /><span className="sr-only"> (новая вкладка)</span></a></div>
        <div className="materials-grid">{materials.map((material, index) => <article className="material-card" key={material.id}><div className={`material-cover cover-${index}`} aria-hidden="true"><span className="cover-line" /><Icon name={material.icon} size={70} /><span className="cover-orbit" /></div><div className="material-body"><span className="eyebrow">{material.category}</span><h3><button onClick={() => setModal({ type: 'article', title: material.title, article: material })}>{material.title}<Icon name="arrow" size={20} /></button></h3><p>{material.intro}</p></div></article>)}</div>
      </section>

      <section className="container section about" id="about" aria-labelledby="about-title"><div><span className="eyebrow">Ваш региональный партнер</span><h2 id="about-title">ГАРАНТ — в системе.<br />Мы — рядом.</h2><p>«Гарант-Сервис Самара» представляет систему ГАРАНТ в Самарской области. Помогаем выбрать наполнение, освоить инструменты и получать поддержку в работе.</p><a className="text-button" href="#contacts">Познакомиться с командой <Icon name="arrow" size={18} /></a></div><div className="about-steps">{[['01', 'Разберемся в задачах', 'Обсудим вашу сферу работы и нужные материалы.'], ['02', 'Покажем возможности', 'Проведем демонстрацию на понятных примерах.'], ['03', 'Поможем освоиться', 'Расскажем об обучении и сопровождении.']].map(([number, title, text]) => <div className="about-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>

      <section className="container section faq" aria-labelledby="faq-title"><div><span className="eyebrow">Есть вопрос?</span><h2 id="faq-title">Отвечаем<br />по существу.</h2></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="container section" id="contacts" aria-labelledby="contacts-title"><div className="contact-panel"><div className="contact-intro"><span className="eyebrow">Гарант-Сервис Самара</span><h2 id="contacts-title">Давайте найдем<br />ваше решение.</h2><p>Расскажите о своей задаче — обсудим возможности системы и следующий шаг.</p><button className="button button-white" onClick={() => request()}>Заказать демонстрацию <Icon name="arrow" size={20} /></button></div><div className="contact-data"><div className="contact-phones">{contacts.phones.map((phone) => <a key={phone.href} href={phone.href}>{phone.label}</a>)}</div><a className="contact-email" href={`mailto:${contacts.email}`}>{contacts.email}<Icon name="external" size={22} /></a><address>{contacts.address}<br />{contacts.office}</address><div className="contact-links"><a href={`https://yandex.ru/maps/?text=${encodeURIComponent(`${contacts.address}, Гарант-Сервис Самара`)}`} target="_blank" rel="noreferrer">Открыть карту <Icon name="external" size={16} /><span className="sr-only"> (новая вкладка)</span></a><button onClick={copyAddress}><Icon name="copy" size={16} /> Скопировать адрес</button></div><p className="copy-status" aria-live="polite">{copyStatus}</p></div></div><p className="contact-source">Контактные данные: <a href={contacts.source} target="_blank" rel="noreferrer">официальный сайт gss.ru<span className="sr-only"> (новая вкладка)</span></a>. Время визита согласуйте по телефону.</p></section>
    </main>

    <footer className="footer"><div className="container"><div className="footer-top"><a className="brand" href="#home"><img src={asset('gss-logo.png')} width="53" height="43" alt="" /><span>Гарант-Сервис <strong>Самара</strong></span></a><p>Правовая информация.<br />Профессиональная поддержка.</p><a href="#home" className="text-button">Наверх ↑</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ЗАО «Гарант-Сервис Самара»</span><button className="text-button" onClick={() => setModal({ type: 'privacy', title: 'Как работает обратная связь' })}>Обработка данных</button><span>Состав и условия услуг уточняйте у специалистов.</span></div></div></footer>

    {modal && <Dialog title={modal.title} onClose={() => setModal(null)}>
      {modal.type === 'request' && <RequestForm topic={modal.title} />}
      {modal.type === 'article' && <div className="article-content"><p className="article-lead">{modal.article.intro}</p>{modal.article.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<button className="button" onClick={() => request('Вопрос по подбору системы ГАРАНТ')}>Обсудить с нами <Icon name="arrow" size={18} /></button></div>}
      {modal.type === 'privacy' && <div className="article-content"><p>Форма подготавливает письмо в вашей почтовой программе. Сайт не отправляет его автоматически и не сохраняет введенные данные на сервере или в браузерном хранилище.</p><p>Нажимая «Открыть письмо», вы передаете введенный текст своей почтовой программе. Проверьте его перед отправкой на {contacts.email}. Без почтовой программы можно скопировать текст и отправить письмо самостоятельно.</p><p>Информацию об обработке полученной корреспонденции можно уточнить у организации по телефону или электронной почте.</p></div>}
    </Dialog>}
  </div>;
}
