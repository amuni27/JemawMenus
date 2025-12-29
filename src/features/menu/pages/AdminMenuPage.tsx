// import { useParams } from 'react-router-dom';
// import { useAuth } from '../../../app/context/AuthContext';
// import MenuSwitcher from '../components/MenuSwitcher';
// import CategoryPanel from '../components/CategoryPanel';
// import ItemsPanel from '../components/ItemsPanel';
// import { useState } from 'react';
// import Button from '../../../components/ui/Button';

export default function AdminMenuPage() {
  // const { tenantSlug } = useParams();
  // const { session } = useAuth();
  // const [selectedMenu, setSelectedMenu] = useState<string | undefined>();

  return (
    <div className="min-h-screen bg-gray-50">
    {/*//   <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">*/}
    {/*//     /!* Header row *!/*/}
    {/*//     <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between sticky top-0 z-10 bg-gray-50/90 backdrop-blur">*/}
    {/*//       <div>*/}
    {/*//         <h1 className="text-2xl font-semibold">Menu Builder</h1>*/}
    {/*//         <p className="text-gray-600">Create categories and items. Toggle availability instead of deleting.</p>*/}
    {/*//       </div>*/}
    {/*//       {session && tenantSlug && (*/}
    {/*//         <div className="flex flex-wrap items-center gap-2">*/}
    {/*//           <MenuSwitcher*/}
    {/*//             className="mb-0"*/}
    {/*//             tenantId={session.business?.id}*/}
    {/*//             tenantSlug={tenantSlug}*/}
    {/*//             selected={selectedMenu}*/}
    {/*//             onSelect={setSelectedMenu}*/}
    {/*//           />*/}
    {/*//           /!* TODO: integrate ItemModal *!/*/}
    {/*//           <Button>+ Add Item</Button>*/}
    {/*//         </div>*/}
    {/*//       )}*/}
    {/*//     </div>*/}
    {/*//*/}
    {/*//     /!* Main grid *!/*/}
    {/*//     <div className="grid gap-6 lg:grid-cols-[280px_1fr]">*/}
    {/*//       <CategoryPanel menuId={selectedMenu} />*/}
    {/*//       <ItemsPanel menuId={selectedMenu} />*/}
    {/*//     </div>*/}
    {/*//   </div>*/}
    </div>
  );
}
