import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute'; 
import DashboardLayout from './layouts/DashboardLayout';

// 公开页面组件
import Home from './pages/Home'; 
import Login from './pages/Login';
import Register from './pages/Register';

// 业务页面组件
import Overview from './pages/dashboard/Overview';
import Bookings from './pages/dashboard/Bookings';
import Payment from './pages/dashboard/Payment';
import PaymentHistory from './pages/dashboard/PaymentHistory'; // 🆕 新增：引入历史记录组件
import Record from './pages/dashboard/Record';
import Doctor from './pages/dashboard/Doctor';
import Storehouse from './pages/dashboard/Storehouse';
import Users from './pages/dashboard/Users';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. 公开入口 */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 2. 受保护的 Dashboard */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          {/* 通用子路由 */}
          <Route path="overview" element={<Overview />} />
          <Route path="record" element={<Record />} />

          {/* === 挂号员模块 === */}
          <Route path="bookings" element={
            <ProtectedRoute allowedRoles={['registration', 'org_admin', 'global_admin']}>
              <Bookings />
            </ProtectedRoute>
          } />

          {/* === 医生模块 === */}
          <Route path="doctor" element={
            <ProtectedRoute allowedRoles={['doctor', 'global_admin']}>
              <Doctor />
            </ProtectedRoute>
          } />

          {/* === 财务模块 (收银台) === */}
          <Route path="payment" element={
            // 注意：收银台通常只给财务看，普通用户(general_user)不应该能进来操作收钱
            // 如果你想让普通用户看自己的账单，那是以后的功能。目前这是"工作台"。
            <ProtectedRoute allowedRoles={['finance', 'org_admin', 'global_admin']}>
              <Payment />
            </ProtectedRoute>
          } />

          {/* 🆕 新增：缴费历史记录路由 === */}
          <Route path="payment-history" element={
            <ProtectedRoute allowedRoles={['finance', 'org_admin', 'global_admin']}>
              <PaymentHistory />
            </ProtectedRoute>
          } />

          {/* === 仓库模块 === */}
          <Route path="storehouse" element={
            <ProtectedRoute allowedRoles={['storekeeper', 'org_admin', 'global_admin']}>
              <Storehouse />
            </ProtectedRoute>
          } />

          {/* === 管理员模块 === */}
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['org_admin', 'global_admin']}>
              <Users />
            </ProtectedRoute>
          } />
        </Route>

        {/* 404 重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;