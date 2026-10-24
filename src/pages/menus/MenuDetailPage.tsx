import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Menu } from "../../types/menu";
import CategoryPanel from "../../components/menu/CategoryPanel.tsx";
import ItemsPanel from "../../components/menu/ItemsPanel.tsx";
import Button from "../../components/ui/Button";
import CategoryModal from "../../components/menu/CategoryModal.tsx";
import ItemModal from "../../components/menu/ItemModal.tsx";
import { useCategories } from "../../hooks/useCategories";
import menuApi from "../../api/menuApi";
import { useItems } from "../../hooks/useItems.ts";
import LoadError from "../../components/ui/LoadError";
import MenuStatusBadge from "../../components/menu/MenuStatusBadge";
import { errorMessage } from "../../utils/errorMessage";

export default function MenuDetailPage() {
  const { menuId } = useParams<{ menuId: string }>();

  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState<Menu | null>(null);
  const categories = useCategories(menuId);
  // ✅ UPDATED: include presign + confirm from hook
  const {
    items,
    toggleStatus,
    toggleSoldOut,
    deleteItem,
    createItem,
    updateItem,
    moveItem,
    presignItemImage,
    confirmItemImage,
  } = useItems(menuId);

  const [error, setError] = useState<string>("");
  const [attempt, setAttempt] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  // modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  useEffect(() => {
    if (!menuId) return;

    let alive = true;
    setLoading(true);
    setError("");

    menuApi
        .getMenu(menuId)
        .then((m) => {
          if (!alive) return;
          setMenu(m.data);
        })
        .catch((err: any) => {
          if (!alive) return;
          setError(errorMessage(err, "Failed to load menu"));
          setMenu(null);
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });

    return () => {
      alive = false;
    };
  }, [menuId, attempt]);

  // Publish / unpublish from the header (AGF-S1-15)
  const togglePublished = async () => {
    if (!menu || !menuId) return;
    setPublishing(true);
    setPublishError("");
    try {
      const res = await menuApi.updateMenu(menuId, { isActive: !menu.active } as Partial<Menu>);
      setMenu((m) => (m ? { ...m, ...res?.data, active: res?.data?.active ?? !m.active } : m));
    } catch (err) {
      setPublishError(errorMessage(err, "Failed to update the menu"));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <div className="p-6"><LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} /></div>;
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
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{menu.name}</h2>
              <MenuStatusBadge menu={menu} />
            </div>
            {publishError && <p role="alert" className="mt-1 text-sm text-red-600">{publishError}</p>}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={togglePublished} disabled={publishing}>
              {menu.active ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="secondary" onClick={() => setCategoryModalOpen(true)}>
              + Add Category
            </Button>
            <Button onClick={() => setItemModalOpen(true)}>+ Add Item</Button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside className="h-fit">
            <CategoryPanel
                menuId={menuId}
                categories={categories.categories}
                loading={categories.loading}
                error={categories.error}
                onCreate={categories.createCategory}
                onUpdate={categories.updateCategory}
                onDelete={categories.deleteCategory}
                onToggleActive={categories.setCategoryActive}
                onMove={categories.moveCategory}
                onReorder={categories.setCategoryOrder}
            />
          </aside>

          <section>
            <ItemsPanel
                menuId={menuId}
                categories={categories.categories}
                items={items}
                toggleStatus={toggleStatus}
                toggleSoldOut={toggleSoldOut}
                deleteItem={deleteItem}
                onMoveItem={moveItem}
                onUpdate={updateItem}
                onCreate={createItem}
                onPresignImage={presignItemImage}
                onConfirmImage={confirmItemImage}
                currency={menu.currency}
            />
          </section>
        </div>

        {/* Modals */}
        <CategoryModal
            open={categoryModalOpen}
            onClose={() => setCategoryModalOpen(false)}
            menuId={menuId}
            onCreate={categories.createCategory}
            onUpdate={categories.updateCategory}
        />

        <ItemModal
            currency={menu.currency}
            open={itemModalOpen}
            onClose={() => setItemModalOpen(false)}
            menuId={menuId}
            categories={categories.categories}
            onUpdate={updateItem}
            onCreate={createItem}
            onPresignImage={presignItemImage}
            onConfirmImage={confirmItemImage}
        />
      </div>
  );
}
