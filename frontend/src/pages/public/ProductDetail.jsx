import { useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { Heart,X,BadgeCheck } from 'lucide-react';
import { products } from '../../data/products';

export default function ProductDetail() {
  const {id}=useParams();
  const product=products.find(p=>p.id===id)||products[0];
  const [activeImage,setActiveImage]=useState(product.image);
  const [modal,setModal]=useState(false);
  const [quantity,setQuantity]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState(false);
  const submit=e=>{e.preventDefault();if(!quantity||!message){setError('Please enter a quantity and message.');return}setError('');setSuccess(true)};
  const images=product.gallery||[product.image,product.image,product.image];
  return (
    <div className="detail-page container">
      <nav className="breadcrumbs"><Link to="/">Marketplace</Link><span>/</span><Link to="/products">Vegetables</Link><span>/</span><b>{product.name}</b></nav>
      <div className="detail-layout">
        <section className="gallery"><div className="main-detail-image"><img src={activeImage} alt={product.name}/></div><div className="thumbnail-row">{images.map((image,i)=><button key={i} className={activeImage===image?'active':''} onClick={()=>setActiveImage(image)}><img src={image} alt={`${product.name} view ${i+1}`}/></button>)}</div></section>
        <section className="product-summary">
          <span className="verified-badge"><BadgeCheck size={12}/> Verified farmer</span><h1>{product.name}</h1><p className="tagline">Farm-fresh, ripe and ready for your business.</p>
          <div className="detail-price"><strong>{product.price.toLocaleString('en-US')} RWF</strong><span>per kilogram</span></div><span className="detail-stock">In stock · {product.quantity.toLocaleString('en-US')} {product.unit} available</span>
          <div className="detail-facts"><div><span>LOCATION</span><strong>{product.location}</strong></div><div><span>MINIMUM ORDER</span><strong>{product.minimumOrder} kg</strong></div></div>
          <h2>Interested in this harvest?</h2><p className="inquiry-copy">Send an inquiry to discuss quantity, pickup and pricing.</p>
          <div className="detail-actions"><button className="primary-action" onClick={()=>{setModal(true);setSuccess(false)}}>Send purchase inquiry <span>→</span></button><button className="save-action"><Heart size={14}/> Save</button></div><small className="inquiry-note">No payment is required to send an inquiry.</small>
          <aside className="farmer-card"><img src={product.farmer.image} alt={product.farmer.name}/><div><h3>{product.farmer.name}</h3><p><BadgeCheck size={12}/> Verified farmer · Member since 2023</p><span>Growing fresh produce with care in {product.farmer.location.split(',')[0]}.</span><Link to="/products">View farmer profile <b>→</b></Link></div></aside>
        </section>
      </div>
      <section className="about-product"><h2>About this product</h2><p>{product.description}</p><div><div><span>HARVEST</span><strong>{product.harvest}</strong></div><div><span>QUALITY</span><strong>{product.quality}</strong></div><div><span>COLLECTION</span><strong>Farm pickup available</strong></div></div></section>
      <div className="connection-note"><strong>A fresh connection, made safely.</strong><p>Agree on price, transport and payment directly with the farmer. Never share your password or verification codes.</p></div>
      {modal&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal(false)}><div className="inquiry-modal" role="dialog" aria-modal="true">{success?<div className="success-state"><BadgeCheck size={38}/><h2>Inquiry sent</h2><p>The farmer will review your request.</p><button onClick={()=>setModal(false)}>Done</button></div>:<form onSubmit={submit}><button type="button" className="modal-close" onClick={()=>setModal(false)}><X size={18}/></button><h2>Purchase inquiry</h2><p>Contact {product.farmer.name} about {product.name}</p><label>Requested quantity ({product.unit})<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder={`Minimum ${product.minimumOrder}`}/></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell the farmer about your pickup or delivery needs"/></label>{error&&<p className="form-error">{error}</p>}<button type="submit">Send inquiry</button></form>}</div></div>}
    </div>
  );
}
