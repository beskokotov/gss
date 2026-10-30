import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

export default function NewsSlider({ news }) {
  const track = useRef(null);
  const animation = useRef(null);
  const [position, setPosition] = useState({ atStart: true, atEnd: news.length <= 3 });

  function stopAnimation() {
    if (animation.current) cancelAnimationFrame(animation.current.frame);
    animation.current = null;
    track.current?.classList.remove('is-animating');
  }

  useEffect(() => {
    const element = track.current;
    function update() {
      const next = {
        atStart: element.scrollLeft <= 1,
        atEnd: element.scrollWidth - element.clientWidth - element.scrollLeft <= 1
      };
      setPosition(previous => previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next);
    }
    const onResize = () => { stopAnimation(); update(); };
    update();
    element.addEventListener('scroll', update, { passive: true });
    element.addEventListener('pointerdown', stopAnimation, { passive: true });
    element.addEventListener('wheel', stopAnimation, { passive: true });
    window.addEventListener('resize', onResize);
    const observer = window.ResizeObserver ? new ResizeObserver(onResize) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      element.removeEventListener('pointerdown', stopAnimation);
      element.removeEventListener('wheel', stopAnimation);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      stopAnimation();
    };
  }, [news.length]);

  function move(direction) {
    const element = track.current;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const step = element.firstElementChild.getBoundingClientRect().width + gap;
    scrollToPosition((animation.current?.target ?? element.scrollLeft) + direction * step);
  }

  function scrollToPosition(requestedTarget) {
    const element = track.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const target = Math.max(0, Math.min(element.scrollWidth - element.clientWidth, requestedTarget));
    if (reducedMotion) {
      stopAnimation();
      element.scrollTo({ left: target, behavior: 'instant' });
      return;
    }
    if (animation.current) cancelAnimationFrame(animation.current.frame);
    const start = element.scrollLeft;
    let startedAt;
    element.classList.add('is-animating');
    const state = { target, frame: 0 };
    animation.current = state;
    function tick(now) {
      startedAt ??= now;
      const progress = Math.min((now - startedAt) / 650, 1);
      // Smootherstep: gradual acceleration and deceleration at both ends.
      const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
      element.scrollLeft = start + (target - start) * eased;
      if (progress < 1) state.frame = requestAnimationFrame(tick);
      else {
        animation.current = null;
        element.classList.remove('is-animating');
      }
    }
    state.frame = requestAnimationFrame(tick);
  }

  function onKeyDown(event) {
    if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') move(event.key === 'ArrowLeft' ? -1 : 1);
    else {
      stopAnimation();
      track.current.scrollTo({ left: event.key === 'Home' ? 0 : track.current.scrollWidth, behavior: 'instant' });
    }
  }

  return <div className="rss-slider" role="region" aria-roledescription="карусель" aria-labelledby="rss-title">
    <div className="rss-grid" id="rss-news-track" ref={track} tabIndex="0" aria-label="Карточки новостей, используйте стрелки влево и вправо" onKeyDown={onKeyDown}
      onFocusCapture={(event) => {
        if (event.target !== event.currentTarget) {
          stopAnimation();
          event.target.closest('.rss-card')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
      }}>
      {news.map((item, index) => <article className="rss-card" key={item.href} aria-label={`${index + 1} из ${news.length}`}>
        {item.image && <a className="rss-image-link" href={item.href} target="_blank" rel="noreferrer" aria-label={`Открыть новость: ${item.title}`}><img src={item.image} alt="" loading="lazy" /></a>}
        <div className="rss-card-body"><div className="rss-meta"><time dateTime={item.date}>{dateFormatter.format(new Date(item.date))}</time><span>{item.category}</span></div><h4><a href={item.href} target="_blank" rel="noreferrer">{item.title}<span className="sr-only"> (на garant.ru, новая вкладка)</span></a></h4><p>{item.description}</p><a className="rss-read-more" href={item.href} target="_blank" rel="noreferrer">Читать новость <Icon name="external" size={16} /><span className="sr-only"> (новая вкладка)</span></a></div>
      </article>)}
    </div>
    <div className="rss-slider-controls"><button className="rss-slider-button rss-slider-prev" type="button" aria-label="Предыдущая новость" aria-controls="rss-news-track" disabled={position.atStart} onClick={() => move(-1)}><Icon name="arrow" size={20} /></button><button className="rss-slider-button" type="button" aria-label="Следующая новость" aria-controls="rss-news-track" disabled={position.atEnd} onClick={() => move(1)}><Icon name="arrow" size={20} /></button>{position.atEnd && !position.atStart && <button className="text-button rss-slider-reset" type="button" aria-controls="rss-news-track" onClick={() => {
      track.current.focus({ preventScroll: true });
      scrollToPosition(0);
    }}>В начало</button>}</div>
  </div>;
}
