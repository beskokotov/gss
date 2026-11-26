import Icon from './Icon.jsx';
import { soutDocuments } from './sout.js';

export default function SoutDetails({ homePath }) {
  return <div className="sout-content">
    <p className="sout-company">ООО «Гарант-Сервис Самара»</p>
    <p>В соответствии с ч. 6 ст. 15 Федерального закона № 426-ФЗ публикуем сводные результаты специальной оценки условий труда и перечень рекомендуемых мероприятий.</p>
    <dl className="sout-facts">
      <div><dt>Дата составления документов</dt><dd><time dateTime="2026-11-16">16.11.2026</time></dd></div>
      <div><dt>Оценено рабочих мест</dt><dd>5</dd></div>
      <div><dt>Класс условий труда</dt><dd>2 (допустимый)</dd></div>
    </dl>
    <p className="sout-result"><Icon name="check" size={18} />По результатам СОУТ дополнительные мероприятия по улучшению условий труда не требуются.</p>
    <ul className="sout-documents">
      {soutDocuments.map(({ title, file }) => {
        const href = `${homePath}sout/${encodeURIComponent(file)}`;
        return <li className="sout-document" key={file}>
          <a className="sout-document-open" href={href} target="_blank" rel="noopener">
            <span className="sout-document-icon"><Icon name="document" size={22} /></span>
            <span>{title}<span className="sr-only"> (PDF, новая вкладка)</span></span>
            <Icon name="external" size={15} />
          </a>
          <a className="text-button sout-download" href={href} download={file} aria-label={`Скачать PDF. ${title}`}>Скачать PDF</a>
        </li>;
      })}
    </ul>
  </div>;
}
