import { useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import ProductCard from '../../components/products/ProductCard';
import { products } from '../../data/products';

export default function ExploreProducts() {
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('');
  const [district,setDistrict] = useState('');
  const [verified,setVerified] = useState(true);
  const [inStock,setInStock] = useState(true);
  const [page,setPage] = useState(1);
  const filtered = useMemo(() => products.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (!category || p.category === category) &&
    (!district || p.district === district) &&
    (!inStock || p.availability === 'In stock')
  ),[search,category,district,inStock]);
  const reset = () => {setSearch('');setCategory('');setDistrict('');setVerified(true);setInStock(true);setPage(1)};
  const categories = ['Vegetables','Fruits','Grains & cereals','Beans & pulses','Roots & tubers'];
  return (
    <div className="explore-page container">
      <h1>Find fresh. Buy local.</h1>
      <div className="search-row">
        <label className="search-box"><Search size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search tomatoes, avocados, farmers..."/></label>
        <button className="search-button">Search products</button><button className="map-button">Map view</button>
      </div>
      <div className="explore-layout">
        <aside className="filters-panel">
          <div className="filter-heading"><h2>Filters</h2><button onClick={reset}>Reset</button></div>
          <fieldset><legend>Category</legend>{categories.map(item=> <label key={item}><input type="checkbox" checked={category===item} onChange={()=>setCategory(category===item?'':item)} /><span>{item}</span></label>)}</fieldset>
          <fieldset><legend>Location</legend><label className="select-wrap"><select value={district} onChange={e=>setDistrict(e.target.value)}><option value="">All districts</option>{[...new Set(products.map(p=>p.district))].sort().map(d=><option key={d}>{d}</option>)}</select><ChevronDown size={14}/></label></fieldset>
          <fieldset><legend>Price range / kg</legend><div className="price-range"><span/><span/></div><div className="price-labels"><span>0 RWF</span><span>10,000 RWF</span></div></fieldset>
          <fieldset><legend>Availability</legend><label><input type="checkbox" checked={inStock} onChange={e=>setInStock(e.target.checked)} /><span>In stock only</span></label><label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)} /><span>Verified farmers</span></label></fieldset>
        </aside>
        <section className="listing-area">
          <div className="listing-heading"><div><strong>{248+filtered.length} products</strong><p>Fresh produce from farmers across Rwanda</p></div><button className="sort-button">Sort: Recommended <ChevronDown size={14}/></button></div>
          {filtered.length ? <div className="explore-grid">{filtered.map(p=><ProductCard key={p.id} product={p}/>)}</div> : <div className="empty-state"><h3>No products found</h3><p>Try changing or clearing your filters.</p><button onClick={reset}>Clear filters</button></div>}
          <div className="pagination"><span>Showing 1-{Math.max(filtered.length,1)} of {248+filtered.length} products</span><div>{['‹','1','2','3','4','…','42','›'].map((item,i)=><button key={i} onClick={()=>item==='‹'||item==='›'||setPage(Number(item)||page)} className={item===String(page)?'active':''}>{item}</button>)}</div></div>
        </section>
      </div>
    </div>
  );
}
