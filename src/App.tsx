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
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Profile from './pages/Profile'
import Candidature from './pages/Candidature'
import RestaurantDashboard from './pages/RestaurantDashboard'
import DriverDashboard from './pages/DriverDashboard'
import RoleGate from './components/RoleGate'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminApplications from './pages/admin/AdminApplications'
import AdminOrders from './pages/admin/AdminOrders'
import AdminRestaurants from './pages/admin/AdminRestaurants'
import AdminDrivers from './pages/admin/AdminDrivers'
import AdminDisputes from './pages/admin/AdminDisputes'
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
        <Route path="/connexion" element={<Layout><Login /></Layout>} />
        <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
        <Route path="/commandes" element={<Layout><Orders /></Layout>} />
        <Route path="/profil" element={<Layout><Profile /></Layout>} />
        <Route path="/candidature" element={<Layout><Candidature /></Layout>} />

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
        </Route>

        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </>
  )
}
