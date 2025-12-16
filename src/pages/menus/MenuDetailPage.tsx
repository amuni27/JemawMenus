import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {Category, Menu} from "../../types/menu";
import CategoryPanel from "../../features/menu/components/CategoryPanel";
import ItemsPanel from "../../features/menu/components/ItemsPanel";
import Button from "../../components/ui/Button";
import CategoryModal from "../../features/menu/components/CategoryModal";
import ItemModal from "../../features/menu/components/ItemModal";
import { useCategories } from "../../features/menu/hooks/useCategories";
import menuApi from "../../api/menuApi";
import categoryApi from "../../api/categoriesApi";

export default function MenuDetailPage() {
  const { menuId } = useParams<{ menuId: string }>();

  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string>("");

  // modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);


  useEffect(() => {
    if (!menuId) return;

    let alive = true;
    setLoading(true);
    setError("");
      console.log(
          menuId
      )
      menuApi.getMenu(menuId)
        .then((m) => {
          if (!alive) return;
          console.log(
              m
          )
          setMenu(m.data);
        })
        .catch((err: any) => {
          if (!alive) return;
          setError(err?.message || "Failed to load menu");
          setMenu(null);
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });

    return () => {
      alive = false;
    };
  }, [menuId]);



  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!menu) return <p className="p-6 text-red-600">Menu not found.</p>;

  return (
      <div>
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <nav className="mb-1 text-sm text-gray-500">
              <Link to={`/${menu.businessId}/admin/menus`} className="hover:underline">
                Menus
              </Link>
              <span className="mx-1">/</span>
              <span>{menu.name}</span>
            </nav>
            <h2 className="text-2xl font-bold">{menu.name}</h2>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
              + Add Category
            </Button>
            <Button onClick={() => setItemModalOpen(true)}>+ Add Item</Button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="h-fit">
            <CategoryPanel menuId={menuId} />
          </aside>

          <section>
            <ItemsPanel menuId={menuId} />
          </section>
        </div>

        {/* Modals */}
        <CategoryModal
            open={categoryModalOpen}
            onClose={() => setCategoryModalOpen(false)}
            menuId={menuId}
        />
        <ItemModal
            open={itemModalOpen}
            onClose={() => setItemModalOpen(false)}
            menuId={menuId}
            categories={categories}
        />
      </div>
  );
}
