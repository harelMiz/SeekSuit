import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";

// Public pages
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";

// Admin pages
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminInventoryPage from "./pages/admin/AdminInventoryPage";
import AdminProductFormPage from "./pages/admin/AdminProductFormPage";
import AdminUploadsPage from "./pages/admin/AdminUploadsPage";

// Public routes:
// /               → homepage with AI search hero
// /shop           → product catalog grid + filters
// /products/:id   → single product detail
// /about          → store info, hours, location
// /contact        → contact form
//
// Admin routes (auth will be added in Step 4):
// /admin/login             → login page
// /admin                   → dashboard (AI insights, stats)
// /admin/inventory         → product list with edit/delete
// /admin/inventory/new     → add product form
// /admin/inventory/:id/edit → edit product form
// /admin/uploads           → image upload + AI processing queue

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/admin/inventory/new" element={<AdminProductFormPage />} />
          <Route path="/admin/inventory/:id/edit" element={<AdminProductFormPage />} />
          <Route path="/admin/uploads" element={<AdminUploadsPage />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
