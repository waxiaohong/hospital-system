import { useEffect, useState } from 'react';
import { Table, Card, Tag, message, Button } from 'antd';
import { ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import request from '../../utils/request'; // 确保路径正确

const PaymentHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // 获取已缴费历史记录
  const fetchHistory = async () => {
    setLoading(true);
    try {
      // 这里的接口对应你刚才在后端 main.go 里加的那行 /history
      const res = await request.get('/dashboard/payment/history');
      // 后端返回的是 { orders: [...] }，所以这里取 res.orders
      // 如果后端直接返回数组，就用 res
      const data = res.orders || res.data || []; 
      setOrders(data);
      message.success('历史记录已刷新');
    } catch (error) {
      console.error('获取历史记录失败:', error);
      message.error('获取历史记录失败，请检查后端');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const columns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '已收金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (text) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{text}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="green">已缴费</Tag>, // 强制显示绿色标签
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    // 注意：这里删掉了“操作”列，因为历史记录不需要操作
  ];

  return (
    <Card 
      title={<><FileTextOutlined /> 缴费历史记录</>} 
      extra={<Button icon={<ReloadOutlined />} onClick={fetchHistory}>刷新列表</Button>}
    >
      <Table
        rowKey="id"
        dataSource={orders}
        columns={columns}
        loading={loading}
      />
    </Card>
  );
};

export default PaymentHistory;