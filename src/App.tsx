import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PermissionGuard } from './components/PermissionGuard';
import { Layout } from './components/Layout';

// Pages — main
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Assets } from './pages/Assets';
import { AssetDetail } from './pages/AssetDetail';
import { Overdue } from './pages/Overdue';
import { ImportData } from './pages/ImportData';
import { AddYCNNAsset } from './pages/AddYCNNAsset';

// Pages — admin
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminAlerts } from './pages/admin/AdminAlerts';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/dang-nhap" element={<Login />} />

          {/* Protected — require login */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/tong-quan" replace />} />
              <Route path="/tong-quan" element={<Dashboard />} />
              <Route path="/thiet-bi" element={<Assets />} />
              <Route path="/thiet-bi/them-ycnn" element={<AddYCNNAsset />} />
              <Route path="/thiet-bi/:id" element={<AssetDetail />} />
              <Route path="/qua-han" element={<Overdue />} />
              <Route path="/nhap-du-lieu" element={<ImportData />} />

              {/* Admin-only routes */}
              <Route element={<PermissionGuard allowedRoles={['admin']} />}>
                <Route path="/quan-tri/nguoi-dung" element={<AdminUsers />} />
                <Route path="/quan-tri/canh-bao" element={<AdminAlerts />} />
              </Route>
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/tong-quan" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
