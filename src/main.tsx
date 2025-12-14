import React from "react";
import ReactDOM from "react-dom/client";
import { AppRouter } from "./app/router";
import { AuthProvider } from "./app/context/AuthContext";
import { ToastProvider } from "./components/ui/ToastContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
