import { ReactNode } from 'react';


interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white shadow-lg rounded-2xl overflow-hidden flex flex-col md:flex-row transition duration-200">
        {/* Branding / side panel */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-rose-400 to-pink-500 items-center justify-center p-8 text-white">
          <h2 className="text-3xl font-bold drop-shadow-lg">AGAFARI MENU</h2>
        </div>
        {/* Form area */}
        <div className="w-full md:w-1/2 p-6 md:p-10">{children}</div>
      </div>
    </div>
  );
}
