import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function ProductTabs({ items, selected, onSelect, onTabKeyDown }) {
  const track = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const element = track.current;
    function update() {
      const next = { start: element.scrollLeft <= 1, end: element.scrollWidth - element.clientWidth - element.scrollLeft <= 1 };
      setEdges(previous => previous.start === next.start && previous.end === next.end ? previous : next);
    }
    update();
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = window.ResizeObserver ? new ResizeObserver(update) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [items.length]);

  useEffect(() => {
    const element = track.current;
    const button = element.children[selected];
    if (!button) return;
    if (button.offsetLeft < element.scrollLeft) scrollTo(button.offsetLeft);
    else if (button.offsetLeft + button.offsetWidth > element.scrollLeft + element.clientWidth) {
      scrollTo(button.offsetLeft + button.offsetWidth - element.clientWidth);
    }
  }, [selected]);

  function scrollTo(left) {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.current.scrollTo?.({ left, behavior: reducedMotion ? 'instant' : 'smooth' });
  }

  function move(direction) {
    const element = track.current;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const step = element.firstElementChild.getBoundingClientRect().width + gap;
    const count = Math.max(1, Math.floor(element.clientWidth / step));
    scrollTo(element.scrollLeft + direction * step * count);
  }

  return <div className="product-tabs-slider">
    <button className="rss-slider-button product-tabs-prev" type="button" aria-label="Предыдущие продукты" aria-controls="product-tabs-track" disabled={edges.start} onClick={() => move(-1)}><Icon name="arrow" size={20} /></button>
    <div className="tabs" id="product-tabs-track" ref={track} role="tablist" aria-label="Продукты ГАРАНТ">
      {items.map((item, index) => <button key={item.id} id={`tab-${item.id}`} type="button" role="tab" aria-selected={index === selected} aria-controls="product-panel" tabIndex={index === selected ? 0 : -1} onKeyDown={(event) => onTabKeyDown(event, index)} onClick={() => onSelect(index)}><Icon name={item.icon} size={20} />{item.label}</button>)}
    </div>
    <button className="rss-slider-button" type="button" aria-label="Следующие продукты" aria-controls="product-tabs-track" disabled={edges.end} onClick={() => move(1)}><Icon name="arrow" size={20} /></button>
  </div>;
}
