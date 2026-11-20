import { BrowserRouter,Navigate,Route,Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Marketplace from './pages/public/Marketplace';
import ExploreProducts from './pages/public/ExploreProducts';
import ProductDetail from './pages/public/ProductDetail';
export default function App(){return <BrowserRouter><MainLayout><Routes><Route path="/" element={<Marketplace/>}/><Route path="/products" element={<ExploreProducts/>}/><Route path="/products/:id" element={<ProductDetail/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></MainLayout></BrowserRouter>}
