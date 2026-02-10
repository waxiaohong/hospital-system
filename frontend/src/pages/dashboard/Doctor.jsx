import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, Select, InputNumber, message, Badge } from 'antd';
import { MedicineBoxOutlined, CheckCircleOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { Option } = Select;
const { TextArea } = Input;

const Doctor = () => {
  const [patients, setPatients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [form] = Form.useForm();

  // 1. 获取候诊列表 (Status = Pending)
  const fetchPatients = async () => {
    try {
      // 对应后端 api.GetPendingPatients
      const res = await request.get('/dashboard/doctor/patients');
      setPatients(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // 2. 打开接诊弹窗
  const handleTreat = (record) => {
    setCurrentPatient(record);
    setIsModalOpen(true);
  };

  // 3. 提交诊断结果
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // 发送给后端：生成病历 + 生成订单
      await request.post('/dashboard/doctor/records', {
        booking_id: currentPatient.id,
        diagnosis: values.diagnosis,
        medicine_id: values.medicine_id, // 选的药
        quantity: values.quantity        // 开几盒
      });
      
      message.success('诊疗完成！已发送至收费处');
      setIsModalOpen(false);
      form.resetFields();
      fetchPatients(); // 刷新列表，该患者应该消失
    } catch (error) {
      message.error('提交失败');
    }
  };

  const columns = [
    { title: '挂号ID', dataIndex: 'id', key: 'id' },
    { title: '患者姓名', dataIndex: 'patient_name', key: 'patient_name', render: t => <b>{t}</b> },
    { title: '年龄', dataIndex: 'age', key: 'age' },
    { title: '科室', dataIndex: 'department', key: 'department', render: t => <Tag color="blue">{t}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: () => <Badge status="processing" text="候诊中" /> },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="primary" icon={<MedicineBoxOutlined />} onClick={() => handleTreat(record)}>
          接诊
        </Button>
      ),
    },
  ];

  return (
    <Card title="👨‍⚕️ 医生工作台 (候诊列表)">
      <Table rowKey="id" dataSource={patients} columns={columns} />

      <Modal 
        title={`正在接诊：${currentPatient?.patient_name}`} 
        open={isModalOpen} 
        onOk={handleOk} 
        onCancel={() => setIsModalOpen(false)}
        okText="提交诊断并开单"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="diagnosis" label="诊断结果" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="例如：急性上呼吸道感染，建议休息..." />
          </Form.Item>
          
          {/* 这里偷个懒，直接硬编码刚才脚本生成的药，实际应该从后端读 */}
          <Form.Item name="medicine_id" label="开具处方药" rules={[{ required: true }]}>
            <Select placeholder="请选择药品">
              <Option value={1}>阿莫西林胶囊 (¥25.5)</Option>
              <Option value={2}>布洛芬缓释胶囊 (¥32.0)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="quantity" label="数量" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} max={10} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Doctor;