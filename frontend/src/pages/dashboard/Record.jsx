import { useEffect, useState } from 'react';
import { Table, Card, Tag, Input, Button, message } from 'antd';
import { FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const Record = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 1. 获取病历列表
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await request.get('/dashboard/record');
      setRecords(res.data || []);
    } catch (error) {
      message.error('获取病历失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // 前端简单的搜索过滤
  const filteredRecords = records.filter(item => 
    item.patient_name?.includes(searchText) || 
    item.diagnosis?.includes(searchText)
  );

  const columns = [
    { title: '病历编号', dataIndex: 'id', key: 'id', width: 100 },
    { 
      title: '患者姓名', 
      dataIndex: 'patient_name', 
      key: 'patient_name',
      render: text => <b>{text}</b>
    },
    { 
      title: '诊断结果', 
      dataIndex: 'diagnosis', 
      key: 'diagnosis',
      render: text => <span style={{ color: '#1890ff' }}>{text}</span>
    },
    { 
      title: '处方/医嘱', 
      dataIndex: 'prescription', 
      key: 'prescription',
      render: text => <Tag color="purple">{text}</Tag>
    },
    { 
      title: '就诊时间', 
      dataIndex: 'created_at', 
      key: 'created_at',
      render: t => new Date(t).toLocaleString() 
    }
  ];

  return (
    <Card title="📂 电子病历档案中心 (EMR)" extra={
        <Input 
            prefix={<SearchOutlined />} 
            placeholder="搜索姓名或诊断..." 
            style={{ width: 200 }}
            onChange={e => setSearchText(e.target.value)} 
        />
    }>
      <Table 
        rowKey="id" 
        dataSource={filteredRecords} 
        columns={columns} 
        loading={loading} 
        pagination={{ pageSize: 8 }}
      />
    </Card>
  );
};

export default Record;