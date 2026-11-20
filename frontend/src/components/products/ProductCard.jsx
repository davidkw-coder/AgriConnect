import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ProductCard({ product }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img src={product.image} alt={product.name} />
        <span className="stock-badge">In stock</span>
        <button className="favorite-button" aria-label={`Save ${product.name}`}><Heart size={14} /></button>
      </div>
      <div className="product-card-body">
        <h3>{product.name}</h3>
        <p className="product-location">{product.location}</p>
        <div className="product-card-footer">
          <div><strong>{product.price.toLocaleString('en-US')} RWF</strong><span> / {product.unit}</span></div>
          <Link to={`/products/${product.id}`}>View product <span aria-hidden="true">→</span></Link>
        </div>
        {product.quantity && <p className="availability">{product.quantity.toLocaleString('en-US')} {product.unit} available</p>}
      </div>
    </article>
  );
}