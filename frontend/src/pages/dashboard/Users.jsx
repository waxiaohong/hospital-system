import { useEffect, useState } from 'react';
import { Table, Card, Tag, message, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const Users = () => {
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await request.get('/dashboard/users');
      setUsers(res.data || []);
    } catch (error) {
      message.error('获取人员名单失败');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const roleColors = {
    'global_admin': 'magenta',
    'org_admin': 'red',
    'doctor': 'blue',
    'nurse': 'cyan',
    'registration': 'cyan',
    'finance': 'gold',
    'storekeeper': 'purple',
    'general_user': 'default'
  };

  const roleNames = {
    'global_admin': '超级管理员',
    'doctor': '医生',
    'registration': '挂号员',
    'finance': '财务',
    'storekeeper': '库管员',
    'general_user': '患者/普通用户'
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { 
      title: '头像', 
      key: 'avatar',
      render: () => <Avatar icon={<UserOutlined />} />
    },
    { 
      title: '用户名', 
      dataIndex: 'username', 
      key: 'username',
      render: text => <b>{text}</b>
    },
    { 
      title: '角色身份', 
      dataIndex: 'role', 
      key: 'role',
      render: role => (
        <Tag color={roleColors[role] || 'default'}>
          {roleNames[role] || role}
        </Tag>
      )
    },
    { title: '注册时间', dataIndex: 'created_at', key: 'created_at', render: t => new Date(t).toLocaleDateString() },
  ];

  return (
    <Card title="👥 医院人员花名册 (管理员视图)">
      <Table rowKey="id" dataSource={users} columns={columns} />
    </Card>
  );
};

export default Users;