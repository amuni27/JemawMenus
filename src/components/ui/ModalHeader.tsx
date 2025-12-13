
interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export default function ModalHeader({ title, subtitle, onClose }: Props) {
  return (
    <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex items-start justify-between rounded-t-2xl bg-white/80 px-6 py-4 backdrop-blur">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100">
        ×
      </button>
    </div>
  );
}
