import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Restaurants from './pages/Restaurants'
import RestaurantDetail from './pages/RestaurantDetail'
import Partenaires from './pages/Partenaires'
import Livreurs from './pages/Livreurs'
import Contact from './pages/Contact'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/restaurants" element={<Restaurants />} />
        <Route path="/restaurant/:id" element={<RestaurantDetail />} />
        <Route path="/partenaires" element={<Partenaires />} />
        <Route path="/livreurs" element={<Livreurs />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </Layout>
  )
}
