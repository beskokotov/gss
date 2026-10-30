import { Fragment, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import HeroSlideshow from './HeroSlideshow.jsx';
import NewsSlider from './NewsSlider.jsx';
import CompanyProfile from './CompanyProfile.jsx';
import ProductHoverSlider from './ProductHoverSlider.jsx';
import JourneySteps from './JourneySteps.jsx';
import ProductDescription from './ProductDescription.jsx';
import { productDescriptions } from './product-descriptions.js';
import { contacts, navigation, products, services, materials, latestNews, questions, makeMailto } from './content.js';

const asset = (name) => `${import.meta.env.BASE_URL}assets/${name}`;
const heroSlides = ['hero-slide-1.webp', 'hero-slide-2.webp', 'hero-slide-3.webp', 'hero-slide-4.webp', 'hero-slide-5.webp'].map(asset);
const heroSlidesMobile = ['hero-slide-1-mobile.webp', 'hero-slide-2-mobile.webp', 'hero-slide-3-mobile.webp', 'hero-slide-4-mobile.webp', 'hero-slide-5-mobile.webp'].map(asset);
const productIcons = Array.from({ length: 17 }, (_, index) => asset(`product-icon-${String(index + 1).padStart(2, '0')}.webp`));

function Dialog({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  const previous = useRef(document.activeElement);
  useEffect(() => {
    ref.current.showModal();
    return () => {
      previous.current?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`} aria-labelledby="dialog-title"
    onCancel={onClose} onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
    <div className="dialog-body">
      <div className="dialog-header">
        <button className="icon-button dialog-close" aria-label="Закрыть окно" onClick={onClose} autoFocus><Icon name="close" /></button>
        <h2 id="dialog-title">{title}</h2>
      </div>
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
  const [product, setProduct] = useState(0);
  const [modal, setModal] = useState(null);
  const [motion, setMotion] = useState(true);
  const [copyStatus, setCopyStatus] = useState('');
  const menuButton = useRef(null);
  const current = products[product];
  const request = (topic = 'Демонстрация системы ГАРАНТ') => setModal({ type: 'request', title: topic });

  function navigateToSection(event, id) {
    setMenu(false);
    if (id !== 'news' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (window.location.hash !== '#news') window.history.pushState(null, '', '#news');

    // Measure after the mobile menu closes, using layout offsets unaffected by reveal animations.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const block = document.getElementById('news');
      if (!block) return;
      const headerHeight = document.querySelector('.header')?.getBoundingClientRect().height ?? 0;
      const availableHeight = window.innerHeight - headerHeight;
      const gap = availableHeight >= block.offsetHeight ? (availableHeight - block.offsetHeight) / 2 : 24;
      let blockTop = 0;
      for (let node = block; node; node = node.offsetParent) blockTop += node.offsetTop;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.max(0, blockTop - headerHeight - gap), behavior: reducedMotion ? 'instant' : 'smooth' });
    }));
  }

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && menu) { setMenu(false); menuButton.current?.focus(); } };
    const onResize = () => { if (window.innerWidth > 1200) setMenu(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [menu]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!motion || reducedMotion?.matches || !window.IntersectionObserver) return;

    const cards = [...document.querySelectorAll('.quick-step, .capability, .product-hover-slider, .profession-panel, .service-card, .support-strip, .material-card, .rss-preview, .about-step, .contact-panel')];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('scroll-reveal-pending');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });

    for (const card of cards) {
      // Animate only cards below the viewport; keep the current screen stable.
      if (card.getBoundingClientRect().top < window.innerHeight) continue;
      const siblingIndex = [...card.parentElement.children].indexOf(card);
      card.style.setProperty('--reveal-delay', `${(siblingIndex % 4) * 50}ms`);
      card.classList.add('scroll-reveal', 'scroll-reveal-pending');
      observer.observe(card);
    }
    const revealFocused = (event) => {
      const card = event.target.closest('.scroll-reveal-pending');
      if (!card) return;
      card.style.setProperty('--reveal-delay', '0ms');
      card.classList.remove('scroll-reveal-pending');
      observer.unobserve(card);
    };
    const revealAll = () => {
      observer.disconnect();
      for (const card of cards) {
        card.classList.remove('scroll-reveal', 'scroll-reveal-pending');
        card.style.removeProperty('--reveal-delay');
      }
    };
    const onPreferenceChange = () => { if (reducedMotion.matches) revealAll(); };
    document.addEventListener('focusin', revealFocused);
    reducedMotion?.addEventListener('change', onPreferenceChange);
    return () => {
      revealAll();
      document.removeEventListener('focusin', revealFocused);
      reducedMotion?.removeEventListener('change', onPreferenceChange);
    };
  }, [motion]);

  async function copyAddress() {
    try { await navigator.clipboard.writeText(`${contacts.address}, ${contacts.office}`); setCopyStatus('Адрес скопирован'); }
    catch { setCopyStatus('Выделите и скопируйте адрес выше'); }
  }

  return <div className="site" data-motion={motion ? 'on' : 'off'}>
    <a className="skip-link" href="#main">Перейти к содержанию</a>
    <header className="header">
      <div className="container masthead">
        <a className="brand brand-modern" href="#home" aria-label="Гарант-Сервис Самара — главная">
          <img src={asset('gss-logo-modern-v1.png')} alt="Гарант-Сервис Самара" width="2172" height="724" />
        </a>
        <nav id="main-navigation" className={`navigation ${menu ? 'is-open' : ''}`} aria-label="Главная навигация">
          <div className="nav-inner">{navigation.map(([id, text], index) => <Fragment key={id}>{index > 0 && <span className="nav-divider" aria-hidden="true" />}<a href={`#${id}`} onClick={(event) => navigateToSection(event, id)}>{text}</a></Fragment>)}</div>
        </nav>
        <button className="button button-small header-request" onClick={() => request('Консультация по системе ГАРАНТ')}>Получить консультацию</button>
        <button ref={menuButton} className="icon-button menu-toggle" aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
      </div>
    </header>

    <main id="main">
      <section className="container hero-section" id="home" aria-labelledby="hero-title">
        <div className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="status-dot" /> Система ГАРАНТ в Самаре</span>
            <h1 id="hero-title">Уверенность<br />в каждом<br /><span>решении</span></h1>
            <p>Правовая информация и экспертная поддержка — чтобы вы могли сосредоточиться на главном</p>
            <div className="actions"><button className="button" onClick={() => request()}>Познакомиться с системой <Icon name="arrow" size={20} /></button><a className="text-button" href="#system">Что умеет ГАРАНТ <Icon name="arrow" size={18} /></a></div>
            <span className="hero-caption">Для бизнеса, специалистов и организаций</span>
          </div>
          <HeroSlideshow images={heroSlides} mobileImages={heroSlidesMobile} motion={motion} />
          <button className="motion-toggle" aria-pressed={!motion} onClick={() => setMotion(!motion)}>{motion ? 'Приостановить анимацию' : 'Включить анимацию'}</button>
        </div>
        <JourneySteps />
      </section>

      <section className="container section" id="system" aria-labelledby="system-title">
        <div className="section-heading"><div><span className="eyebrow">Больше, чем справочник</span><h2 id="system-title">Сложные вопросы<br />Понятные инструменты</h2></div><p>Электронно-периодический справочник системы ГАРАНТ: нормативные документы, практика и профессиональные материалы в едином информационном пространстве.</p></div>
        <div className="capability-grid">
          <article className="capability capability-main"><div><span className="icon-tile"><Icon name="search" size={28} /></span><h3>От вопроса<br />к нужному документу</h3><p>Поиск помогает находить правовую информацию. Связанные материалы дают контекст для работы.</p><a className="text-button" href="#solutions">Выбрать свое направление <Icon name="arrow" size={18} /></a></div><img src={asset('research-art.webp')} alt="" width="1536" height="1024" loading="lazy" /></article>
          <article className="capability lavender"><span className="icon-tile"><Icon name="document" size={28} /></span><h3>Право и практика</h3><p>Федеральное и региональное законодательство, судебная практика и комментарии.</p></article>
          <article className="capability mint"><span className="icon-tile"><Icon name="layers" size={28} /></span><h3>От теории к действию</h3><p>Практические ситуации, формы и образцы документов для повседневной работы.</p></article>
        </div>
      </section>

      <section className="container section" id="solutions" aria-labelledby="solutions-title">
        <div className="section-heading"><div><span className="eyebrow">Под ваши задачи</span><h2 id="solutions-title">ГАРАНТ-<span className="legaltech-accent">LegalTech</span><br />Автоматизация <span className="legaltech-accent">правовых</span> задач</h2></div><p>Онлайн-сервисы ГАРАНТ помогут сэкономить время специалистов и средства организации.</p></div>
        <ProductHoverSlider items={products} icons={productIcons} selected={product} motion={motion} onSelect={setProduct} />
        <div id="product-panel" className={`profession-panel${productDescriptions[current.id] ? ' profession-panel-detailed' : ''}`} role="tabpanel" aria-labelledby={`tab-${current.id}`} tabIndex="0">
          {productDescriptions[current.id] ? <ProductDescription description={productDescriptions[current.id]} /> : <>
          <div className="profession-copy"><span className="pill">{current.tag}</span><h3>{current.title}</h3><p>{current.text}</p></div>
          <div className="profession-list"><span className="eyebrow">Что обсудим при подборе</span>{current.items.map(item => <div className="check-row" key={item}><span><Icon name="check" size={18} /></span>{item}</div>)}<p className="form-note">Точный состав комплекта и стоимость уточняются индивидуально.</p></div>
          </>}
        </div>
      </section>

      <section className="service-section" id="services" aria-labelledby="services-title"><div className="container section">
        <div className="section-heading"><div><span className="eyebrow">Поддержка на каждом этапе</span><h2 id="services-title">Система. Сервисы.<br />Люди рядом</h2></div><p>Познакомиться, освоить, разобраться в вопросе — региональная команда поможет двигаться дальше.</p></div>
        <div className="service-grid">{services.map((service) => <article className={`service-card ${service.color}`} key={service.title}><span className="icon-tile"><Icon name={service.icon} size={28} /></span><h3>{service.title}</h3><p>{service.text}</p><button className="text-button" onClick={() => request(service.title)}>Об услуге <Icon name="arrow" size={18} /></button></article>)}</div>
        <div className="support-strip"><div><Icon name="users" size={28} /><span><strong>Уже работаете с ГАРАНТ?</strong><small>Поможем с использованием и техническими вопросами.</small></span></div><button className="text-button" onClick={() => request('Помощь пользователю системы ГАРАНТ')}>Связаться с поддержкой <Icon name="arrow" size={20} /></button></div>
      </div></section>

      <section className="container section" id="materials" aria-labelledby="materials-title"><div className="section-heading"><div><span className="eyebrow">Полезно знать</span><h2 id="materials-title">Начните с главного</h2></div><a className="text-button" href="https://www.garant.ru/news/" target="_blank" rel="noreferrer">Правовые новости на ГАРАНТ.РУ <Icon name="external" size={18} /><span className="sr-only"> (новая вкладка)</span></a></div>
        <div className="materials-grid">{materials.map((material, index) => <article className="material-card" key={material.id}><div className={`material-cover cover-${index}`} aria-hidden="true"><span className="cover-line" /><Icon name={material.icon} size={70} /><span className="cover-orbit" /></div><div className="material-body"><span className="eyebrow">{material.category}</span><h3><button onClick={() => setModal({ type: 'article', title: material.title, article: material })}>{material.title}</button></h3><p>{material.intro}</p></div></article>)}</div>
        {latestNews.length > 0 && <div className="rss-preview" id="news" aria-labelledby="rss-title">
          <div className="rss-heading"><div><h2 id="rss-title">Последние правовые новости</h2><p className="eyebrow">Коротко о важных изменениях. Полные материалы — на сайте ГАРАНТ.РУ.</p></div><a className="text-button" href="https://www.garant.ru/news/" target="_blank" rel="noreferrer">Все новости <Icon name="external" size={18} /><span className="sr-only"> (новая вкладка)</span></a></div>
          <NewsSlider news={latestNews} />
          <p className="rss-source-note">Источник: <a href="https://rss.garant.ru/news/" target="_blank" rel="noreferrer">официальная RSS-лента ГАРАНТ.РУ</a>. Обновление выполняется автоматически.</p>
        </div>}
      </section>

      <section className="container section about" id="about" aria-labelledby="about-title">
        <div>
          <span className="eyebrow">Ваш региональный партнер</span>
          <h2 id="about-title">ГАРАНТ — в системе<br />мы — рядом</h2>
          <p><strong>«Гарант-Сервис Самара»</strong> — региональный партнёр компании «Гарант», уже более 30 лет помогающий организациям и специалистам Самарской области уверенно ориентироваться в законодательстве и эффективно решать профессиональные задачи.</p>
          <p>Мы не просто предоставляем доступ к системе ГАРАНТ. Мы помогаем подобрать подходящее решение, разобраться в современных правовых инструментах и использовать их возможности с максимальной пользой.</p>
          <p>А главное — остаёмся рядом, обеспечивая профессиональное сопровождение, обучение и поддержку на каждом этапе работы.</p>
          <button className="text-button" type="button" aria-haspopup="dialog" onClick={() => setModal({ type: 'company', title: 'О компании «Гарант-Сервис Самара»' })}>Познакомиться с компанией <Icon name="arrow" size={18} /></button>
        </div>
        <div className="about-steps">{[
          ['01', 'Разберёмся в задачах', 'Обсудим вашу сферу работы, задачи специалистов и нужные материалы.'],
          ['02', 'Подберём подходящее решение', 'Поможем выбрать оптимальное наполнение и сервисы под ваши рабочие процессы.'],
          ['03', 'Покажем возможности', 'Проведём демонстрацию системы на понятных практических примерах.'],
          ['04', 'Поможем освоиться', 'Расскажем об обучении, сопровождении и поддержке пользователей.'],
          ['05', 'Будем рядом в работе', 'Окажем сервисную помощь и поможем получать максимум пользы от системы ГАРАНТ.']
        ].map(([number, title, text]) => <div className="about-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      </section>

      <section className="container section faq" aria-labelledby="faq-title"><div><span className="eyebrow">Есть вопрос?</span><h2 id="faq-title">Отвечаем<br />по существу</h2></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="container section" id="contacts" aria-labelledby="contacts-title"><div className="contact-panel"><div className="contact-intro"><span className="eyebrow">Гарант-Сервис Самара</span><h2 id="contacts-title">Давайте найдем<br />ваше решение</h2><p>Расскажите о своей задаче — обсудим возможности системы и следующий шаг.</p><button className="button button-white" onClick={() => request()}>Заказать демонстрацию <Icon name="arrow" size={20} /></button></div><div className="contact-data"><div className="contact-phones">{contacts.phones.map((phone) => <a key={phone.href} href={phone.href}>{phone.label}</a>)}</div><a className="contact-email" href={`mailto:${contacts.email}`}>{contacts.email}<Icon name="external" size={22} /></a><address>{contacts.address}<br />{contacts.office}</address><div className="contact-links"><a href={contacts.mapUrl} target="_blank" rel="noreferrer">Открыть карту <Icon name="external" size={16} /><span className="sr-only"> (новая вкладка)</span></a><button onClick={copyAddress}><Icon name="copy" size={16} /> Скопировать адрес</button></div><p className="copy-status" aria-live="polite">{copyStatus}</p></div></div></section>
    </main>

    <footer className="footer"><div className="container"><div className="footer-top"><a className="brand brand-modern" href="#home"><img src={asset('gss-logo-modern-v1.png')} width="2172" height="724" alt="ГАРАНТ-СЕРВИС САМАРА" /></a><a className="footer-garant-brand" href="https://www.garant.ru/" aria-label="ГАРАНТ — 35 лет рядом с вами"><img src={asset('garant-logo-35-years.webp')} alt="ГАРАНТ — 35 лет рядом с вами" width="640" height="256" /></a><div className="footer-contact-actions"><a className="footer-phone" href={contacts.phones[0].href}>{contacts.phones[0].label}<small>Связаться с командой</small></a><a href="#home" className="text-button">Наверх ↑</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ЗАО «Гарант-Сервис Самара»</span><button className="text-button" onClick={() => setModal({ type: 'privacy', title: 'Как работает обратная связь' })}>Обработка данных</button><span>Состав и условия услуг уточняйте у специалистов.</span></div></div></footer>

    {modal && <Dialog title={modal.title} onClose={() => setModal(null)} className={modal.type === 'company' ? 'company-dialog' : ''}>
      {modal.type === 'company' && <CompanyProfile />}
      {modal.type === 'request' && <RequestForm topic={modal.title} />}
      {modal.type === 'article' && <div className="article-content"><p className="article-lead">{modal.article.intro}</p>{modal.article.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<button className="button" onClick={() => request('Вопрос по подбору системы ГАРАНТ')}>Обсудить с нами <Icon name="arrow" size={18} /></button></div>}
      {modal.type === 'privacy' && <div className="article-content"><p>Форма подготавливает письмо в вашей почтовой программе. Сайт не отправляет его автоматически и не сохраняет введенные данные на сервере или в браузерном хранилище.</p><p>Нажимая «Открыть письмо», вы передаете введенный текст своей почтовой программе. Проверьте его перед отправкой на {contacts.email}. Без почтовой программы можно скопировать текст и отправить письмо самостоятельно.</p><p>Информацию об обработке полученной корреспонденции можно уточнить у организации по телефону или электронной почте.</p></div>}
    </Dialog>}
  </div>;
}
