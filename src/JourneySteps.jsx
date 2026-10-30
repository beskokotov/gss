import { useState } from 'react';
import Icon from './Icon.jsx';

const steps = [
  ['Найти правовую основу', 'Определите свой правовой вопрос'],
  ['Связаться с нами', 'Расскажите нам о задаче'],
  ['Подобрать решение', 'Мы подберём подходящие инструменты'],
  ['Получить поддержку', 'Поможем освоиться и будем рядом']
];

export default function JourneySteps() {
  const [opened, setOpened] = useState(null);
  return <ol className="quick-links journey-steps" aria-label="Этапы работы с нами">
    {steps.map(([title, description], index) => <li className="quick-step" key={title}>
      <button type="button" className="quick-step-card" aria-label={title} aria-expanded={opened === index} aria-controls={`journey-cover-${index}`} aria-describedby={`journey-cover-${index}`}
        onPointerEnter={event => { if (event.pointerType !== 'touch') setOpened(index); }}
        onPointerLeave={event => { if (event.pointerType !== 'touch') setOpened(null); }}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setOpened(index); }}
        onBlur={() => setOpened(null)}
        onClick={event => { if (event.detail === 0 || window.matchMedia?.('(hover: none)').matches) setOpened(previous => previous === index ? null : index); }}
        onKeyDown={event => { if (event.key === 'Escape') setOpened(null); }}>
        <span className="quick-step-title">{title}</span>
        <span className="quick-step-cover" id={`journey-cover-${index}`}><span>{description}</span></span>
      </button>
      {index < steps.length - 1 && <span className="journey-connector" aria-hidden="true"><Icon name="arrow" size={16} /></span>}
    </li>)}
  </ol>;
}
