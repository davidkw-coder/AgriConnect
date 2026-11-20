import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="AgriConnect marketplace">
          <img className="brand-logo" src="/logos/AgriConnect-Rwanda.png" alt="AgriConnect Rwanda" />
        </Link>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`main-nav ${open ? 'open' : ''}`} aria-label="Main navigation">
          <NavLink to="/" end onClick={() => setOpen(false)}>Marketplace</NavLink>
          <NavLink to="/products" onClick={() => setOpen(false)}>Find farmers</NavLink>
          <NavLink to="/products" onClick={() => setOpen(false)}>How it works</NavLink>
        </nav>
        <div className="header-actions">
          <button className="language-button">EN <ChevronDown size={13} /></button>
          <button className="login-button">Log In</button>
          <button className="join-button">Join AgriConnect</button>
        </div>
      </div>
    </header>
  );
}