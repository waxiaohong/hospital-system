import { useEffect, useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, InputNumber, Tag, message, Statistic } from 'antd';
import { PlusOutlined, MedicineBoxOutlined, AlertOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const Storehouse = () => {
  const [meds, setMeds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 1. 获取库存列表
  const fetchInventory = async () => {
    try {
      const res = await request.get('/dashboard/storehouse');
      setMeds(res.data || []);
    } catch (error) {
      message.error('获取库存失败');
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // 2. 提交新药入库
  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await request.post('/dashboard/storehouse', values);
      message.success('💊 新药品入库成功！');
      setIsModalOpen(false);
      form.resetFields();
      fetchInventory();
    } catch (error) {
      console.error(error);
    }
  };

  const columns = [
    { title: '药品ID', dataIndex: 'id', key: 'id' },
    { 
      title: '药品名称', 
      dataIndex: 'name', 
      key: 'name',
      render: (text) => <><MedicineBoxOutlined /> {text}</>
    },
    { 
      title: '单价', 
      dataIndex: 'price', 
      key: 'price',
      render: (price) => `¥ ${price.toFixed(2)}`
    },
    { 
      title: '当前库存', 
      dataIndex: 'stock', 
      key: 'stock',
      render: (stock) => {
        let color = stock > 50 ? 'green' : 'red';
        return (
            <Tag color={color}>
                {stock} {stock < 50 && <AlertOutlined />}
            </Tag>
        );
      }
    },
  ];

  return (
    <Card title="📦 医院中心药房" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
        采购入库
      </Button>
    }>
      <Table rowKey="id" dataSource={meds} columns={columns} />

      <Modal title="采购新药品" open={isModalOpen} onOk={handleAdd} onCancel={() => setIsModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="药品名称" rules={[{ required: true }]}>
            <Input placeholder="例如：999感冒灵" />
          </Form.Item>
          <Form.Item name="price" label="销售单价 (元)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stock" label="入库数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {/* 这里我们偷懒默认 OrgID=1，实际项目后端会自动从 Token 取 */}
          <Form.Item name="org_id" hidden initialValue={1}><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Storehouse;