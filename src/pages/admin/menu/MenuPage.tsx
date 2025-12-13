import Tabs from '../../../components/ui/Tabs';
import CategoriesPanel from './CategoriesPanel';
import ItemsPanel from './ItemsPanel';

export default function MenuPage() {
  return (
    <Tabs
      tabs={[
        { label: 'Categories', content: <CategoriesPanel /> },
        { label: 'Items', content: <ItemsPanel /> },
      ]}
    />
  );
}
