import { useEffect, useState } from 'react';
import { MenuCategory } from '../../../types';
import * as api from '../../../api/menu';
import { Input } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../app/context/AuthContext';

export default function CategoriesPanel() {
  const { session } = useAuth();
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const { tenantSlug } = useParams();

  useEffect(() => {
    if (session) {
      api.getCategories(session.tenantId).then(setCats);
    }
  }, [session]);

  const add = async () => {
    if (!newName.trim() || !session) return;
    setLoading(true);
    const cat = await api.createCategory(session.tenantId, newName.trim());
    setCats((c) => [...c, cat]);
    setNewName('');
    setLoading(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete category?')) return;
    await api.deleteCategory(id);
    setCats((c) => c.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Add Category</h2>
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
          <Button onClick={add} isLoading={loading}>
            Add
          </Button>
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Categories</h2>
        <ul className="space-y-2">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded border p-2">
              <span>
                {c.sortOrder + 1}. {c.name}
              </span>
              <Button variant="danger" onClick={() => del(c.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
