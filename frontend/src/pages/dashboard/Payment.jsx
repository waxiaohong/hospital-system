// 文件路径: frontend/src/pages/dashboard/Finance.jsx

import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message, Statistic, Row, Col } from 'antd';
import { DollarOutlined, ReloadOutlined, AccountBookOutlined } from '@ant-design/icons';
import request from '../../utils/request'; // 引入组长封装好的请求工具

const Finance = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. 获取后端数据
  const fetchUnpaidOrders = async () => {
    setLoading(true);
    try {
      // 组长的 request 工具配置了 baseURL=/api/v1，所以这里写 /dashboard/payment/ 即可
      // 对应后端路由: GET /api/v1/dashboard/payment/
      const res = await request.get('/dashboard/payment/');
      
      // 后端 api.go 返回的是 c.JSON(..., gin.H{"data": orders})
      // request.js 拦截器直接返回了 response.data，所以这里取 res.data
      setOrders(res.data || []);
      message.success('数据已刷新');
    } catch (error) {
      console.error(error);
      message.error('获取订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时自动拉取
  useEffect(() => {
    fetchUnpaidOrders();
  }, []);

  // 2. 确认收费逻辑
  const handleConfirm = async (orderId) => {
    try {
      // 对应后端路由: POST /api/v1/dashboard/payment/
      // 对应 api.go 里的 PaymentRequest { OrderID uint }
      await request.post('/dashboard/payment/', { order_id: orderId });
      
      message.success('收费成功！库存已扣减');
      // 成功后刷新列表，刚交完费的订单会消失（因为状态变 Paid 了）
      fetchUnpaidOrders(); 
    } catch (error) {
      console.error(error);
      // request.js 会自动捕获后端的 error message
      const errorMsg = error.response?.data?.error || '收费失败';
      message.error(errorMsg);
    }
  };

  // 表格列定义
  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id' },
    { 
      title: '应收金额', 
      dataIndex: 'total_amount', 
      key: 'total_amount',
      render: (val) => <span style={{color: '#cf1322', fontWeight: 'bold', fontSize: '16px'}}>¥ {val}</span>
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => <Tag color={status === 'Unpaid' ? 'orange' : 'green'}>{status}</Tag>
    },
    { 
      title: '创建时间', 
      dataIndex: 'created_at', 
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          icon={<DollarOutlined />}
          onClick={() => handleConfirm(record.id)}
        >
          确认收款
        </Button>
      )
    }
  ];

  return (
    <div>
      {/* 顶部统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic 
              title="待处理订单数" 
              value={orders.length} 
              prefix={<AccountBookOutlined />} 
            />
          </Card>
        </Col>
      </Row>

      {/* 订单列表区域 */}
      <Card 
        title="🏥 财务收银台" 
        extra={<Button icon={<ReloadOutlined />} onClick={fetchUnpaidOrders}>刷新列表</Button>}
      >
        <Table 
          rowKey="id"
          dataSource={orders} 
          columns={columns} 
          loading={loading}
          locale={{ emptyText: '当前没有待缴费的订单' }}
        />
      </Card>
    </div>
  );
};

export default Finance;