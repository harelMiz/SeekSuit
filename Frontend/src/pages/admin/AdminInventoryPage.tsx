import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, ImageOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import AdminLayout from "../../components/layout/AdminLayout";
import { getProducts, deleteProduct } from "../../services/product.service";
import type { Product } from "../../types/product";

// Number of rows shown per page
const PAGE_SIZE = 10;

export default function AdminInventoryPage() {
  const { t } = useLang();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  function loadProducts() {
    setLoading(true);
    getProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleDelete(product: Product) {
    if (!window.confirm(t("admin.deleteConfirm"))) return;
    await deleteProduct(product.id);
    loadProducts();
  }

  // Pagination math
  const totalPages = Math.ceil(products.length / PAGE_SIZE);
  const paginated = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AdminLayout>
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-secondary mb-1">
            Stock Overview
          </p>
          <h1 className="font-headline text-3xl font-bold text-on-surface">
            Product Catalogue
          </h1>
        </div>
        <Link
          to="/admin/inventory/new"
          className="gold-shimmer flex items-center gap-2 text-sm font-semibold text-on-tertiary-fixed px-5 py-3 rounded-xl transition-opacity hover:opacity-90"
        >
          <Plus size={16} />
          {t("admin.addProduct")}
        </Link>
      </div>

      {/* Table area */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-secondary mt-8">
          {t("common.loading")}
        </div>
      ) : products.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-secondary mt-8">
          {t("shop.noProducts")}
        </div>
      ) : (
        <div className="mt-8 bg-surface-container-low p-1 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-start text-[10px] text-secondary uppercase tracking-widest px-5 py-4 font-semibold w-20">
                  Item
                </th>
                <th className="text-start text-[10px] text-secondary uppercase tracking-widest px-4 py-4 font-semibold">
                  Name
                </th>
                <th className="text-start text-[10px] text-secondary uppercase tracking-widest px-4 py-4 font-semibold hidden md:table-cell">
                  SKU / Type
                </th>
                <th className="text-start text-[10px] text-secondary uppercase tracking-widest px-4 py-4 font-semibold hidden md:table-cell">
                  Color
                </th>
                <th className="text-start text-[10px] text-secondary uppercase tracking-widest px-4 py-4 font-semibold">
                  Status
                </th>
                <th className="text-end px-5 py-4 w-20" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((product) => (
                <tr
                  key={product.id}
                  className="group border-b border-outline-variant/50 hover:bg-surface-container-high/30 transition-colors"
                >
                  {/* Thumbnail */}
                  <td className="px-5 py-4">
                    <div className="w-16 h-20 bg-surface-variant rounded-lg overflow-hidden">
                      {product.processedImageUrl ?? product.rawImageUrl ? (
                        <img
                          src={(product.processedImageUrl ?? product.rawImageUrl)!}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageOff size={16} className="text-outline-variant" />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-4 font-semibold text-on-surface">
                    {product.name}
                  </td>

                  {/* SKU / Type */}
                  <td className="px-4 py-4 hidden md:table-cell">
                    <p className="text-xs font-mono text-secondary">{product.sku}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {t(`type.${product.type}`)}
                    </p>
                  </td>

                  {/* Color */}
                  <td className="px-4 py-4 text-secondary hidden md:table-cell">
                    {product.color}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                        product.status === "in_stock"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {t(`status.${product.status}`)}
                    </span>
                  </td>

                  {/* Actions — fade in on row hover */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/admin/inventory/${product.id}/edit`}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(product)}
                        className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant">
            <p className="text-xs text-secondary">
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, products.length)}–{Math.min(page * PAGE_SIZE, products.length)} of {products.length} items
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-on-surface-variant border border-outline-variant rounded-lg disabled:opacity-40 hover:bg-surface-container-high transition-colors"
              >
                <ChevronLeft size={13} />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-on-surface-variant border border-outline-variant rounded-lg disabled:opacity-40 hover:bg-surface-container-high transition-colors"
              >
                Next
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
