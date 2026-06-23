import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { ColorProvider } from "./context/ColorContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Public pages
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import GalleryPage from "./pages/GalleryPage";

import AuthCallbackPage from "./pages/AuthCallbackPage";

// Admin pages
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminInventoryPage from "./pages/admin/AdminInventoryPage";
import AdminProductFormPage from "./pages/admin/AdminProductFormPage";
import AdminUploadsPage from "./pages/admin/AdminUploadsPage";
import AdminVTOModelsPage from "./pages/admin/AdminVTOModelsPage";
import AdminGalleryPage from "./pages/admin/AdminGalleryPage";
import AdminContentPage from "./pages/admin/AdminContentPage";

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
      <AuthProvider>
        <ColorProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/gallery" element={<GalleryPage />} />

            {/* Auth callback — handles password reset and invite acceptance */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Admin login — public */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Admin pages — protected: require authenticated session */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/inventory" element={<ProtectedRoute><AdminInventoryPage /></ProtectedRoute>} />
            <Route path="/admin/inventory/new" element={<ProtectedRoute><AdminProductFormPage /></ProtectedRoute>} />
            <Route path="/admin/inventory/:id/edit" element={<ProtectedRoute><AdminProductFormPage /></ProtectedRoute>} />
            <Route path="/admin/uploads" element={<ProtectedRoute><AdminUploadsPage /></ProtectedRoute>} />
            <Route path="/admin/vto-models" element={<ProtectedRoute><AdminVTOModelsPage /></ProtectedRoute>} />
            <Route path="/admin/gallery" element={<ProtectedRoute><AdminGalleryPage /></ProtectedRoute>} />
            <Route path="/admin/content" element={<ProtectedRoute><AdminContentPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
        </ColorProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
