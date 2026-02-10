import {
    Home, UserPlus, Stethoscope, CreditCard,
    Package, FileText, Settings, History // 👈 1. 新增：这里加了一个 History 图标
} from 'lucide-react';
import { ROLES } from './roles';

export const menuConfig = [
    {
        path: 'overview',
        label: '概览',
        icon: <Home size={18} />,
        roles: Object.values(ROLES)
    },
    {
        path: 'bookings',
        label: '预约挂号',
        icon: <UserPlus size={18} />,
        roles: [ROLES.GENERAL_USER, ROLES.REGISTRATION]
    },
    {
        path: 'doctor',
        label: '医生工作台',
        icon: <Stethoscope size={18} />,
        roles: [ROLES.DOCTOR]
    },
    // === 财务模块 ===
    {
        path: 'payment',
        label: '缴费中心',
        icon: <CreditCard size={18} />,
        // 注意：如果你只想让财务看收银台，可以去掉 GENERAL_USER
        roles: [ROLES.GENERAL_USER, ROLES.FINANCE] 
    },
    {
        path: 'payment-history', // 👈 2. 新增：这就是你刚做的历史记录页面
        label: '缴费记录',
        icon: <History size={18} />, // 使用 History 图标 (或者 FileText)
        roles: [ROLES.FINANCE, ROLES.ORG_ADMIN, ROLES.GLOBAL_ADMIN] // 权限：财务+管理员
    },
    // ===============
    {
        path: 'storehouse',
        label: '物资库房',
        icon: <Package size={18} />,
        roles: [ROLES.STOREKEEPER, ROLES.ORG_ADMIN, ROLES.GLOBAL_ADMIN]
    },
    {
        path: 'record',
        label: '记录',
        icon: <FileText size={18} />,
        roles: Object.values(ROLES)
    },
    {
        path: 'users',
        label: '账号管理',
        icon: <Settings size={18} />,
        roles: [ROLES.ORG_ADMIN, ROLES.GLOBAL_ADMIN]
    }
];