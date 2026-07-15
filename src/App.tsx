import { Routes, Route } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import Layout from './components/Layout'
import BackOfficeLayout from './components/BackOfficeLayout'
import Home from './pages/Home'
import Restaurants from './pages/Restaurants'
import RestaurantDetail from './pages/RestaurantDetail'
import Partenaires from './pages/Partenaires'
import Livreurs from './pages/Livreurs'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Inscription from './pages/Inscription'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Profile from './pages/Profile'
import Candidature from './pages/Candidature'
import ExplorerMet from './pages/ExplorerMet'
import Favorites from './pages/Favorites'
import DishDetail from './pages/DishDetail'
import RestaurantDashboard from './pages/RestaurantDashboard'
import DriverDashboard from './pages/DriverDashboard'
import RoleGate from './components/RoleGate'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminApplications from './pages/admin/AdminApplications'
import AdminOrders from './pages/admin/AdminOrders'
import AdminRestaurants from './pages/admin/AdminRestaurants'
import AdminDrivers from './pages/admin/AdminDrivers'
import AdminDisputes from './pages/admin/AdminDisputes'
import AdminDishCatalog from './pages/admin/AdminDishCatalog'
import AdminZones from './pages/admin/AdminZones'
import AdminDeliveryFees from './pages/admin/AdminDeliveryFees'
import AdminMedia from './pages/admin/AdminMedia'
import FoodRequestCreate from './pages/FoodRequestCreate'
import FoodRequestList from './pages/FoodRequestList'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <>
      <Toaster position="bottom-center" richColors />
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/restaurants" element={<Layout><Restaurants /></Layout>} />
        <Route path="/restaurant/:id" element={<Layout><RestaurantDetail /></Layout>} />
        <Route path="/partenaires" element={<Layout><Partenaires /></Layout>} />
        <Route path="/livreurs" element={<Layout><Livreurs /></Layout>} />
        <Route path="/contact" element={<Layout><Contact /></Layout>} />
        <Route path="/connexion" element={<Layout><Login defaultRole="client" /></Layout>} />
        <Route path="/admin/connexion" element={<Layout><Login defaultRole="admin" /></Layout>} />
        <Route path="/partenaires/connexion" element={<Layout><Login defaultRole="restaurant" /></Layout>} />
        <Route path="/livreurs/connexion" element={<Layout><Login defaultRole="livreur" /></Layout>} />
        <Route path="/inscription" element={<Layout><Inscription defaultRole="client" /></Layout>} />
        <Route path="/inscription/restaurant" element={<Layout><Inscription defaultRole="restaurant" /></Layout>} />
        <Route path="/inscription/livreur" element={<Layout><Inscription defaultRole="livreur" /></Layout>} />
        <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
        <Route path="/commandes" element={<Layout><Orders /></Layout>} />
        <Route path="/profil" element={<Layout><Profile /></Layout>} />
        <Route path="/candidature" element={<Layout><Candidature /></Layout>} />
        <Route path="/explorer" element={<Layout><ExplorerMet /></Layout>} />
        <Route path="/favoris" element={<Layout><Favorites /></Layout>} />
        <Route path="/plat/:slug" element={<Layout><DishDetail /></Layout>} />
        <Route path="/demandes/nouvelle" element={<Layout><FoodRequestCreate /></Layout>} />
        <Route path="/demandes/mes-demandes" element={<Layout><FoodRequestList /></Layout>} />

        {/* Restaurant dashboard (sidebar + nested pages) */}
        <Route
          path="/partenaires/dashboard"
          element={
            <BackOfficeLayout>
              <RoleGate allow={['restaurant', 'admin']} />
            </BackOfficeLayout>
          }
        >
          <Route index element={<RestaurantDashboard />} />
          <Route path="menu" element={<RestaurantDashboard tab="menu" />} />
          <Route path="profile" element={<RestaurantDashboard tab="profile" />} />
          <Route path="finances" element={<RestaurantDashboard tab="finances" />} />
        </Route>

        {/* Driver dashboard (sidebar + nested pages) */}
        <Route
          path="/livreurs/dashboard"
          element={
            <BackOfficeLayout>
              <RoleGate allow={['livreur', 'admin']} />
            </BackOfficeLayout>
          }
        >
          <Route index element={<DriverDashboard />} />
          <Route path="courses" element={<DriverDashboard tab="mine" />} />
          <Route path="gains" element={<DriverDashboard tab="wallet" />} />
        </Route>

        {/* Admin back-office (sidebar + nested pages) */}
        <Route
          path="/admin"
          element={
            <BackOfficeLayout>
              <RoleGate allow={['admin']} />
            </BackOfficeLayout>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="restaurants" element={<AdminRestaurants />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route path="dishes" element={<AdminDishCatalog />} />
          <Route path="zones" element={<AdminZones />} />
          <Route path="delivery-fees" element={<AdminDeliveryFees />} />
          <Route path="media" element={<AdminMedia />} />
        </Route>

        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </>
  )
}
