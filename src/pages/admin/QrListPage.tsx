import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQrStore } from '../../store/QrStore';
import CreateQrModal from '../../components/admin/CreateQrModal';
import StatusPill from '../../components/admin/StatusPill';
import KebabMenu from '../../components/admin/KebabMenu';
import Button from '../../components/ui/Button';

export default function QrListPage() {
  const { entries, add, updateStatus } = useQrStore();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filtered = entries.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    return e.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by QR code or project name"
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <Button onClick={() => setShowModal(true)}>+ Create QR</Button>
      </div>

      <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left">
                <input type="checkbox" />
              </th>
              <th className="p-3 text-left">QR</th>
              <th className="p-3 text-left">Short link</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Project</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Updated</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="p-3">
                  <input type="checkbox" />
                </td>
                <td className="p-3 font-medium text-gray-800">{e.name}</td>
                <td className="p-3 text-blue-600 underline">{e.shortLink}</td>
                <td className="p-3">{e.type}</td>
                <td className="p-3">{e.projectName ?? '—'}</td>
                <td className="p-3">
                  <StatusPill status={e.status} />
                </td>
                <td className="p-3">{new Date(e.updatedAt).toLocaleString()}</td>
                <td className="p-3 text-right">
                  <KebabMenu
                    onRename={() => {
                      const newName = prompt('Rename', e.name);
                      if (newName) updateStatus(e.id, e.status);
                    }}
                    onPause={() => updateStatus(e.id, e.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}
                    onTrash={() => updateStatus(e.id, 'TRASH')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateQrModal
          onCreate={(name, type) => add({ name, type })}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
