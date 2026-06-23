import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/layout/Layout";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import PatientQuickVisit from "./pages/PatientQuickVisit";
import FirstVisitPage from "./pages/FirstVisitPage";
import WorkupVisitPage from "./pages/WorkupVisitPage";
import Criteria from "./pages/Criteria";
import Guidelines from "./pages/Guidelines";
import Miscellanea from "./pages/Miscellanea";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PublicPRO from "./pages/PublicPRO";
import ConsultPage from "./pages/ConsultPage";
import ExamUploadPage from "./pages/ExamUploadPage";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Caricamento...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/pro/:token" element={<PublicPRO />} />
      <Route path="/c/:token" element={<ConsultPage />} />
      <Route path="/exam-upload/:token" element={<ExamUploadPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pazienti" element={<Patients />} />
                  <Route path="/pazienti/:id" element={<ErrorBoundary><PatientDetail /></ErrorBoundary>} />
                  <Route path="/pazienti/:id/visita" element={<PatientQuickVisit />} />
                  <Route path="/pazienti/:id/prima-visita" element={<FirstVisitPage />} />
                  <Route path="/pazienti/:id/visita-workup" element={<WorkupVisitPage />} />
                  <Route path="/criteri" element={<Criteria />} />
                  <Route path="/linee-guida" element={<Guidelines />} />
                  <Route path="/miscellanea" element={<Miscellanea />} />
                  <Route path="/privacy" element={<Privacy />} />
                </Routes>
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
