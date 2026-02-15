import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Alert } from 'antd';
import { 
  UserOutlined, 
  MedicineBoxOutlined, 
  AccountBookOutlined, 
  TeamOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

const Overview = () => {
  const [stats, setStats] = useState({
    income: 0,
    patients: 0,
    doctors: 0,
    meds: 0
  });

  // --- 核心修复：多重手段获取角色 ---
  // 解决 "localStorage 里的 user 没更新导致角色识别错误" 的问题
  const getUserRole = () => {
    // 1. 优先尝试从 Token 解析 (最稳准狠的办法)
    const token = localStorage.getItem('token');
    if (token) {
        try {
            // JWT 的第二部分是 Payload，Base64解码
            const payload = JSON.parse(atob(token.split('.')[1]));
            // 只要 Token 里有 role，就以 Token 为准
            if (payload.role) return payload.role; 
        } catch (e) {
            console.error("Token解析失败", e);
        }
    }

    // 2. 如果 Token 没读到，尝试从 localStorage user 对象读 (降级方案)
    const userStr = localStorage.getItem('user');
    try { 
        const userObj = JSON.parse(userStr || '{}'); 
        if (userObj.role) return userObj.role;
    } catch(e) {}
    
    return 'general_user'; // 实在没有，才兜底
  };

  const role = getUserRole();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchStats = async () => {
    // 只有非普通用户才去请求统计接口，避免 403 报错
    if (role !== 'general_user') {
      try {
        const res = await request.get('/dashboard/stats');
        setStats(res); 
      } catch (error) {
        console.error("获取统计数据失败:", error);
      }
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // --- 封装卡片组件 (消除 valueStyle 警告) ---
  const CustomStatistic = ({ title, value, prefix, suffix, color, precision }) => (
    <Statistic
      title={title}
      value={value}
      precision={precision}
      prefix={prefix}
      suffix={suffix}
      formatter={(val) => (
        <span style={{ color: color, fontWeight: 'bold' }}>{val}</span>
      )}
    />
  );

  // 定义各个维度的卡片
  const IncomeCard = () => (
    <Col span={6}>
      <Card hoverable>
        <CustomStatistic 
          title="累计营收 (Total Income)" 
          value={stats.income} 
          precision={2} 
          color="#3f8600" 
          prefix={<AccountBookOutlined />} 
          suffix="元" 
        />
      </Card>
    </Col>
  );

  const PatientCard = () => (
    <Col span={6}>
      <Card hoverable>
        <CustomStatistic 
          title="接诊患者 (Patients)" 
          value={stats.patients} 
          color="#1890ff" 
          prefix={<UserOutlined />} 
          suffix="人次" 
        />
      </Card>
    </Col>
  );

  const DoctorCard = () => (
    <Col span={6}>
      <Card hoverable>
        <CustomStatistic 
          title="在岗医生 (Doctors)" 
          value={stats.doctors} 
          color="#fa8c16" 
          prefix={<TeamOutlined />} 
          suffix="人" 
        />
      </Card>
    </Col>
  );

  const MedicineCard = () => (
    <Col span={6}>
      <Card hoverable>
        <CustomStatistic 
          title="药品库存种类 (Medicines)" 
          value={stats.meds} 
          color="#722ed1" 
          prefix={<MedicineBoxOutlined />} 
          suffix="种" 
        />
      </Card>
    </Col>
  );

  // --- 核心逻辑：根据角色决定渲染哪些卡片 ---
  const renderCardsByRole = () => {
    // 1. 管理员 (看所有)
    if (['global_admin', 'org_admin'].includes(role)) {
      return <>{IncomeCard()}{PatientCard()}{DoctorCard()}{MedicineCard()}</>;
    }
    
    // 2. 财务 (只看钱) - 增加容错
    if (['finance', 'money', 'fin'].includes(role)) {
      return <>{IncomeCard()}</>;
    }

    // 3. 医生/护士/挂号员 (看病人 + 药) - 增加容错
    if (['doctor', 'nurse', 'registration', 'doc'].includes(role)) {
      return <>{PatientCard()}{MedicineCard()}</>;
    }

    // 4. 库管 (只看药) - 增加容错
    if (['storekeeper', 'store', 'sto'].includes(role)) {
      return <>{MedicineCard()}</>;
    }

    // 5. 普通用户 (显示专属服务引导)
    if (role === 'general_user') {
      return (
        <Col span={12}>
          <Card title="🎓 我的服务" bordered={false} hoverable>
             <p style={{ fontSize: '16px' }}>您好，欢迎使用智慧医疗自助服务。</p>
             <p style={{ color: '#666' }}>
               您可以点击左侧菜单进行 
               <b style={{ color: '#1890ff', margin: '0 5px' }}>预约挂号</b> 
               或 
               <b style={{ color: '#52c41a', margin: '0 5px' }}>查询/缴纳账单</b>。
             </p>
          </Card>
        </Col>
      );
    }

    // 兜底
    return <Col span={24}><Alert message={`暂无数据权限 (角色: ${role})`} type="info" showIcon /></Col>;
  };

  return (
    <div className="site-statistic-demo-card">
      <h2 style={{ marginBottom: 20 }}>
        📊 医院运营驾驶舱 
        <span style={{fontSize:14, color:'#999', fontWeight:'normal', marginLeft: 10}}>
          (当前身份: {role})
        </span>
      </h2>
      
      {/* 上半部分：核心指标 (分角色) */}
      <Row gutter={16}>
        {renderCardsByRole()}
      </Row>

      {/* 下半部分：通用的欢迎卡片 (保留你原有的设计) */}
      <Card style={{ marginTop: 20, textAlign: 'center', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
            <h1 style={{ color: '#1890ff' }}>Welcome, {user.username || 'User'}!</h1>
            <p style={{ color: '#999' }}>用心守护每一位患者 | 当前身份: {role}</p>
        </div>
      </Card>
    </div>
  );
};

export default Overview;