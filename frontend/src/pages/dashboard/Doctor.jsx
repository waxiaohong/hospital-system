import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, Select, InputNumber, message, Badge } from 'antd';
import { MedicineBoxOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { TextArea } = Input;

const Doctor = () => {
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [form] = Form.useForm();

  // 1. 获取候诊列表 (Status = Pending)
  const fetchPatients = async () => {
    try {
      const res = await request.get('/dashboard/doctor/patients');
      setPatients(res.data || []);
    } catch (error) {
      console.error(error);
      message.error('获取候诊列表失败');
    }
  };

  // 2. 新增：获取库存药品列表 (实现联动)
  const fetchMedicines = async () => {
    try {
      // 复用仓库接口获取实时库存
      const res = await request.get('/dashboard/storehouse');
      setMedicines(res.data || []);
    } catch (error) {
      console.error("获取药品列表失败", error);
      message.error('获取药品数据失败，请检查仓库配置');
    }
  };

  // 初始化加载
  useEffect(() => {
    const initData = async () => {
      await Promise.all([fetchPatients(), fetchMedicines()]);
    };
    initData();
  }, []);

  // 3. 打开接诊弹窗
  const handleTreat = (record) => {
    setCurrentPatient(record);
    setIsModalOpen(true);
  };

  // 4. 提交诊断结果
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // 发送给后端：生成病历 + 生成订单
      await request.post('/dashboard/doctor/medical_records', {
        booking_id: currentPatient.id,
        diagnosis: values.diagnosis,
        medicine_id: values.medicine_id,
        quantity: values.quantity
      });
      message.success('诊疗完成！已发送至收费处');
      setIsModalOpen(false);
      form.resetFields();
      fetchPatients(); // 刷新列表，已完成的患者会消失
    } catch (error) {
      const errorMsg = error.response?.data?.error || '提交失败';
      message.error(errorMsg);
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
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="diagnosis" label="诊断结果" rules={[{ required: true, message: '请输入诊断建议' }]}>
            <TextArea rows={4} placeholder="请录入症状描述与初步诊断结果..." />
          </Form.Item>

          <Form.Item name="medicine_id" label="开具处方药" rules={[{ required: true }]}>
            <Select
              placeholder="请选择药品"
              // 将 medicines 数组转换为 options 数组
              options={medicines.map(med => ({
                label: `${med.name} (单价: ¥${med.price.toFixed(2)} | 库存: ${med.stock})`,
                value: med.id,
                disabled: med.stock <= 0 // 库存不足时禁用
              }))}
            />
          </Form.Item>

          <Form.Item name="quantity" label="开药数量" initialValue={1} rules={[{ required: true }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Doctor;