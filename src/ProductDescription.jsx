import Icon from './Icon.jsx';

export default function ProductDescription({ description }) {
  return <div className="product-description">
    <header className="product-description-heading"><span className="pill">{description.name}</span><h3>{description.title}</h3></header>
    <div className="product-description-intro">
      <section><h4>Как это работает</h4>{description.how.map(text => <p key={text}>{text}</p>)}</section>
      <section><h4>Для кого создан</h4>{description.audience.map(text => <p key={text}>{text}</p>)}</section>
    </div>
    <section className="product-description-benefits"><h4>Благодаря этому сервису вы получите</h4><ul>{description.benefits.map(([title, text]) => <li key={title}><span className="product-description-check" aria-hidden="true"><Icon name="check" size={18} /></span><div><h5>{title}</h5><p>{text}</p></div></li>)}</ul></section>
  </div>;
}
