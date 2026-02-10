import { useEffect, useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, InputNumber, Tag, message } from 'antd';
import { PlusOutlined, UserOutlined, PhoneOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { Option } = Select;

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 1. 获取列表
  const fetchBookings = async () => {
    try {
      const res = await request.get('/dashboard/bookings');
      setBookings(res.data || []);
    } catch (error) {
      console.error(error);
      message.error('获取列表失败');
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // 2. 提交挂号
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await request.post('/dashboard/bookings', values);
      message.success('🎉 挂号成功！');
      setIsModalOpen(false);
      form.resetFields();
      fetchBookings(); // 刷新列表
    } catch (error) {
      console.error(error);
    }
  };

  const columns = [
    { title: '挂号ID', dataIndex: 'id', key: 'id' },
    { title: '患者姓名', dataIndex: 'patient_name', key: 'patient_name', render: t => <b>{t}</b> },
    { title: '年龄', dataIndex: 'age', key: 'age' },
    { title: '性别', dataIndex: 'gender', key: 'gender' },
    { title: '科室', dataIndex: 'department', key: 'department', render: t => <Tag color="blue">{t}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: t => <Tag color={t === 'Pending' ? 'orange' : 'green'}>{t === 'Pending' ? '候诊中' : '已就诊'}</Tag> },
    { title: '挂号时间', dataIndex: 'created_at', key: 'created_at', render: t => new Date(t).toLocaleString() },
  ];

  return (
    <Card title="🏥 门诊挂号大厅" extra={
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>现场挂号</Button>
    }>
      <Table rowKey="id" dataSource={bookings} columns={columns} />

      {/* 挂号弹窗 */}
      <Modal title="填写挂号单" open={isModalOpen} onOk={handleOk} onCancel={() => setIsModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="patient_name" label="姓名" rules={[{ required: true }]}>
            <Input prefix={<UserOutlined />} placeholder="张三" />
          </Form.Item>
          <Form.Item name="gender" label="性别" rules={[{ required: true }]}>
             <Select><Option value="男">男</Option><Option value="女">女</Option></Select>
          </Form.Item>
          <Form.Item name="age" label="年龄" rules={[{ required: true }]}>
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="phone" label="联系电话">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item name="department" label="挂号科室" rules={[{ required: true }]}>
            <Select>
              <Option value="内科">内科 (Internal Med)</Option>
              <Option value="外科">外科 (Surgery)</Option>
              <Option value="儿科">儿科 (Pediatrics)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Bookings;