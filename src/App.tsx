import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import Layout from './components/Layout'
import BackOfficeLayout from './components/BackOfficeLayout'
import OrderPingModal from './components/OrderPingModal'
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
import Favorites from './pages/Favorites'
import DishDetail from './pages/DishDetail'
import RestaurantDashboard from './pages/RestaurantDashboard'
import DriverDashboard from './pages/DriverDashboard'
import RoleGate from './components/RoleGate'
import AdminPermissionGate from './components/AdminPermissionGate'
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
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminReviews from './pages/admin/AdminReviews'
import AdminPoints from './pages/admin/AdminPoints'
import AdminTrash from './pages/admin/AdminTrash'
import AdminQuotas from './pages/admin/AdminQuotas'
import AdminRoles from './pages/admin/AdminRoles'
import AdminOperations from './pages/admin/AdminOperations'
import AdminApplicationCreate from './pages/admin/AdminApplicationCreate'
import AdminKyc from './pages/admin/AdminKyc'
import AdminKycDossier from './pages/admin/AdminKycDossier'
import AdminFinance from './pages/admin/AdminFinance'
import AdminAppearance from './pages/admin/AdminAppearance'
import AdminPromotions from './pages/admin/AdminPromotions'
import FoodRequestCreate from './pages/FoodRequestCreate'
import FoodRequestList from './pages/FoodRequestList'
import MealPrograms from './pages/MealPrograms'
import MealProgramDetail from './pages/MealProgramDetail'
import Subscriptions from './pages/Subscriptions'
import RestaurantPrograms from './pages/RestaurantPrograms'
import RestaurantFoodRequests from './pages/RestaurantFoodRequests'
import AdminSubscriptions from './pages/admin/AdminSubscriptions'
import NotFound from './pages/NotFound'

// LOT-13 (CONF-33) : /explorer est fusionné dans /restaurants (mode plats).
// Redirection qui préserve les deep-links ?q=&ville=&quartier=.
function ExplorerRedirect() {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.set('mode', 'plats')
  return <Navigate to={`/restaurants?${params.toString()}`} replace />
}

// Ancienne route fiche plat (/article/:slug) — les liens WhatsApp déjà
// partagés doivent continuer de fonctionner après le renommage en /plat/.
function ArticleRedirect() {
  const { pathname } = useLocation()
  return <Navigate to={pathname.replace(/^\/article\//, '/plat/')} replace />
}

// CP8 : build mobile CLIENT (Capacitor) — constante remplacée au build par
// Vite ; en build web normal elle vaut false et rien ne change.
const CLIENT_ONLY_TARGET = import.meta.env.VITE_APP_TARGET === 'client';

export default function App() {
  // mobileOffset : au-dessus de la MobileBottomNav (56px) ; sur les fiches
  // resto/plat, aussi au-dessus de leur barre panier fixe (56 + 64px).
  const { pathname } = useLocation()
  const hasOwnCartBar = pathname.startsWith('/plat/') || pathname.startsWith('/restaurant/')
  return (
    <>
      <Toaster position="bottom-center" richColors mobileOffset={{ bottom: hasOwnCartBar ? 132 : 72 }} />
      <OrderPingModal />
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/restaurants" element={<Layout><Restaurants /></Layout>} />
        <Route path="/restaurant/:slug" element={<Layout><RestaurantDetail /></Layout>} />
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
        <Route path="/explorer" element={<ExplorerRedirect />} />
        <Route path="/favoris" element={<Layout><Favorites /></Layout>} />
        <Route path="/plat/:slug" element={<Layout><DishDetail /></Layout>} />
        <Route path="/article/:slug" element={<ArticleRedirect />} />
        <Route path="/demandes/nouvelle" element={<Layout><FoodRequestCreate /></Layout>} />
        <Route path="/demandes/mes-demandes" element={<Layout><FoodRequestList /></Layout>} />
        <Route path="/programmes" element={<Layout><MealPrograms /></Layout>} />
        <Route path="/programmes/:id" element={<Layout><MealProgramDetail /></Layout>} />
        <Route path="/abonnements" element={<Layout><Subscriptions /></Layout>} />

        {/* Back-offices — exclus du build mobile CLIENT (CP8) : avec
            VITE_APP_TARGET=client, Vite remplace la constante au build et
            élimine ces routes (et leur code) du bundle. Le web reste intact. */}
        {!CLIENT_ONLY_TARGET && (
        <>
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
          <Route path="programmes" element={<RestaurantPrograms />} />
          <Route path="demandes" element={<RestaurantFoodRequests />} />
          <Route path="livreurs" element={<RestaurantDashboard tab="drivers" />} />
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
          <Route index element={<Navigate to="/admin/connexion" replace />} />
          <Route path="dashboard" element={<AdminPermissionGate permission="dashboard.view"><AdminDashboard /></AdminPermissionGate>} />
          <Route path="applications" element={<AdminPermissionGate permission="applications.view"><AdminApplications /></AdminPermissionGate>} />
          <Route path="applications/nouveau/:role" element={<AdminPermissionGate permission="applications.view"><AdminApplicationCreate /></AdminPermissionGate>} />
          <Route path="orders" element={<AdminPermissionGate permission="orders.view"><AdminOrders /></AdminPermissionGate>} />
          <Route path="operations" element={<AdminPermissionGate permission="operations.view"><AdminOperations /></AdminPermissionGate>} />
          <Route path="kyc" element={<AdminPermissionGate permission="kyc.view"><AdminKyc /></AdminPermissionGate>} />
          <Route path="kyc/:applicationId" element={<AdminPermissionGate permission="kyc.view"><AdminKycDossier /></AdminPermissionGate>} />
          <Route path="finance" element={<AdminPermissionGate permission="finance.dashboard.view"><AdminFinance /></AdminPermissionGate>} />
          <Route path="subscriptions" element={<AdminPermissionGate permission="food.subscriptions.view"><AdminSubscriptions /></AdminPermissionGate>} />
          <Route path="restaurants" element={<AdminPermissionGate permission="restaurants.view"><AdminRestaurants /></AdminPermissionGate>} />
          <Route path="drivers" element={<AdminPermissionGate permission="couriers.view"><AdminDrivers /></AdminPermissionGate>} />
          <Route path="disputes" element={<AdminPermissionGate permission="orders.disputes.resolve"><AdminDisputes /></AdminPermissionGate>} />
          <Route path="dishes" element={<AdminPermissionGate permission="dishes.manage"><AdminDishCatalog /></AdminPermissionGate>} />
          <Route path="zones" element={<AdminPermissionGate permission="zones.manage"><AdminZones /></AdminPermissionGate>} />
          <Route path="delivery-fees" element={<AdminPermissionGate permission="delivery_fees.manage"><AdminDeliveryFees /></AdminPermissionGate>} />
          <Route path="media" element={<AdminPermissionGate permission="media.manage"><AdminMedia /></AdminPermissionGate>} />
          <Route path="customers" element={<AdminPermissionGate permission="customers.view"><AdminCustomers /></AdminPermissionGate>} />
          <Route path="reviews" element={<AdminPermissionGate permission="reviews.view"><AdminReviews /></AdminPermissionGate>} />
          <Route path="points" element={<AdminPermissionGate permission="points.manage"><AdminPoints /></AdminPermissionGate>} />
          <Route path="trash" element={<AdminPermissionGate permission="trash.manage"><AdminTrash /></AdminPermissionGate>} />
          <Route path="quotas" element={<AdminPermissionGate permission="quotas.manage"><AdminQuotas /></AdminPermissionGate>} />
          <Route path="apparence" element={<AdminPermissionGate permission="appearance.manage"><AdminAppearance /></AdminPermissionGate>} />
          <Route path="promotions" element={<AdminPermissionGate permission="promotions.manage"><AdminPromotions /></AdminPermissionGate>} />
          <Route path="roles" element={<AdminPermissionGate permission="admin.roles.view"><AdminRoles /></AdminPermissionGate>} />
        </Route>
        </>
        )}

        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </>
  )
}

