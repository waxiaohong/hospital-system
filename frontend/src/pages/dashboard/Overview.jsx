import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, message } from 'antd';
import { 
  UserOutlined, 
  MedicineBoxOutlined, 
  AccountBookOutlined, 
  TeamOutlined,
  ArrowUpOutlined
} from '@ant-design/icons';
import request from '../../utils/request';

const Overview = () => {
  const [stats, setStats] = useState({
    income: 0,
    patients: 0,
    doctors: 0,
    meds: 0
  });

  const fetchStats = async () => {
    try {
      const res = await request.get('/dashboard/stats');
      // 后端返回的是 { income, patients, doctors, meds }
      setStats(res); 
    } catch (error) {
      console.error(error);
      // 如果报错，说明后端没重启或者路由没配对，暂时不弹窗打扰
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="site-statistic-demo-card">
      <h2 style={{ marginBottom: 20 }}>📊 医院运营驾驶舱</h2>
      
      <Row gutter={16}>
        <Col span={6}>
          <Card hoverable>
            <Statistic
              title="累计营收 (Total Income)"
              value={stats.income}
              precision={2}
              valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
              prefix={<AccountBookOutlined />}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable>
            <Statistic
              title="接诊患者 (Patients)"
              value={stats.patients}
              valueStyle={{ color: '#1890ff' }}
              prefix={<UserOutlined />}
              suffix="人次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable>
            <Statistic
              title="在岗医生 (Doctors)"
              value={stats.doctors}
              prefix={<TeamOutlined />}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable>
            <Statistic
              title="药品库存种类 (Medicines)"
              value={stats.meds}
              prefix={<MedicineBoxOutlined />}
              suffix="种"
            />
          </Card>
        </Col>
      </Row>

      {/* 这里可以加一张图，或者放个欢迎标语 */}
      <Card style={{ marginTop: 20, textAlign: 'center', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
            <h1 style={{ color: '#ccc' }}>Welcome to Smart Hospital System</h1>
            <p style={{ color: '#999' }}>用心守护每一位患者</p>
        </div>
      </Card>
    </div>
  );
};

export default Overview;