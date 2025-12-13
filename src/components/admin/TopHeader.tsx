import Button from '../../components/ui/Button';

interface Props {
  placeholder?: string;
  onCreate?: () => void;
  createLabel: string;
}

export default function TopHeader({ placeholder = 'Search...', onCreate, createLabel }: Props) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-6 py-3 sticky top-0 z-20">
      <input
        type="text"
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-400"
      />
      <Button onClick={onCreate}>{createLabel}</Button>
    </div>
  );
}
