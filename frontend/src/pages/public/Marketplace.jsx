import { ArrowRight, BadgeCheck, PackageCheck, MapPin, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../../components/products/ProductCard';
import { products } from '../../data/products';

export default function Marketplace() {
  const categories = ['All products','Vegetables','Fruits','Grains & cereals','Beans & pulses','Roots & tubers'];
  return (
    <div className="marketplace-page">
      <section className="marketplace-hero container">
        <div className="hero-main"><img src="/images/banners/hero-farmer.png" alt="Farmer carrying fresh vegetables" /></div>
        <div className="hero-side"><img src="/images/banners/farm-worker.jpg" alt="Farm workers harvesting crops" /></div>
      </section>
      <section className="category-bar container">
        {categories.map((category, index) => <button className={index === 0 ? 'active' : ''} key={category}>{category}</button>)}
      </section>
      <section className="featured-section container">
        <div className="section-heading"><h2>Fresh picks, straight from the farm</h2><Link to="/products">View all products <ArrowRight size={13} /></Link></div>
        <div className="featured-grid">{products.slice(0,4).map(product => <ProductCard key={product.id} product={product} />)}</div>
      </section>
      <section className="trust-strip container">
        <div><BadgeCheck size={14} /><span>Verified farmers</span></div>
        <div><PackageCheck size={14} /><span>Direct farmer connections</span></div>
        <div><MapPin size={14} /><span>All 30 districts</span></div>
        <div><WalletCards size={14} /><span>RWF Transparent pricing</span></div>
      </section>
    </div>
  );
}
