import { useEffect, useState } from "react";
import {
  Table,
  Card,
  Tag,
  message,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
} from "antd";
import { 
  UserOutlined, 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined 
} from "@ant-design/icons";
import request from "../../utils/request";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // 标记当前正在编辑的用户
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 监听表单中的 role 字段，用于联动显示科室
  const selectedRole = Form.useWatch("role", form);

  // 1. 获取人员名单
  const fetchUsers = async () => {
    try {
      const res = await request.get("/dashboard/users");
      setUsers(res.data || []);
    } catch (error) {
      console.error(error);
      message.error("获取用户名单失败");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. 打开新增窗口
  const handleOpenAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // 3. 打开编辑窗口 (保留原有功能)
  const handleEdit = (record) => {
    setEditingUser(record);
    // 回填表单数据
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      department: record.department,
    });
    setIsModalOpen(true);
  };

  // 4. 删除用户逻辑 (新增功能)
  const handleDelete = async (id) => {
    try {
      await request.delete(`/dashboard/users/${id}`);
      message.success("删除成功");
      fetchUsers(); // 刷新列表
    } catch (error) {
      console.error(error);
      message.error("删除失败");
    }
  };

  // 5. 提交表单 (兼容新增和修改)
  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      if (editingUser) {
        // === 编辑模式 (PUT) ===
        await request.put(`/dashboard/users/${editingUser.id}`, {
          role: values.role,
          department: values.department,
          // 如果不想在编辑时强制改密码，后端应处理 password 为空的情况
          password: values.password,
        });
        message.success("用户信息更新成功");
      } else {
        // === 新增模式 (POST) ===
        await request.post("/dashboard/users", values);
        message.success("🎉 用户账号创建成功！");
      }

      setIsModalOpen(false);
      form.resetFields();
      fetchUsers(); // 刷新表格
    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.error || "操作失败";
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 角色配置
  const roleOptions = [
    { label: "临床医生 (Doctor)", value: "doctor" },
    { label: "挂号员 (Registration)", value: "registration" },
    { label: "财务 (Finance)", value: "finance" },
    { label: "库房管理员 (Storekeeper)", value: "storekeeper" },
    { label: "院区负责人 (Org Admin)", value: "org_admin" },
  ];

  // 科室配置
  const departmentOptions = [
    { label: "内科 (Internal Med)", value: "内科" },
    { label: "外科 (Surgery)", value: "外科" },
    { label: "儿科 (Pediatrics)", value: "儿科" },
    { label: "骨科 (Orthopedics)", value: "骨科" },
    { label: "急诊 (Emergency)", value: "急诊" },
  ];

  const roleColors = {
    global_admin: "magenta",
    org_admin: "red",
    doctor: "blue",
    registration: "cyan",
    finance: "gold",
    storekeeper: "purple",
    general_user: "default",
  };

  const roleNames = {
    global_admin: "全局管理员",
    org_admin: "院区负责人",
    doctor: "医生",
    registration: "挂号员",
    finance: "财务",
    storekeeper: "库管员",
    general_user: "患者",
  };

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
      render: (text) => <b>{text}</b>,
    },
    {
      title: "角色身份",
      dataIndex: "role",
      key: "role",
      render: (role) => (
        <Tag color={roleColors[role] || "default"}>
          {roleNames[role] || role}
        </Tag>
      ),
    },
    {
      title: "所属科室",
      dataIndex: "department",
      key: "department",
      render: (text, record) =>
        record.role === "doctor" ? (
          text ? (
            <Tag color="geekblue">{text}</Tag>
          ) : (
            <Tag>未分配</Tag>
          )
        ) : (
          "-"
        ),
    },
    {
      title: "注册时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (t) => new Date(t).toLocaleDateString(),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          {/* 1. 保留原有编辑按钮 */}
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>

          {/* 2. 新增删除按钮 (带确认框) */}
          <Popconfirm
            title={`确定要删除用户 "${record.username}" 吗？`}
            description="此操作不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="👥 医院人员编制管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
          新增用户
        </Button>
      }
    >
      <Table
        rowKey="id"
        dataSource={users}
        columns={columns}
        pagination={{ pageSize: 8 }}
      />

      <Modal
        title={editingUser ? "编辑用户信息" : "录入新用户信息"}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true, message: "请输入账号" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="例如：doctor_li"
              disabled={!!editingUser}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? "重置密码 (留空则不修改)" : "初始密码"}
            rules={[{ required: !editingUser, message: "请输入密码" }]}
          >
            <Input.Password placeholder="建议设置为复杂密码" />
          </Form.Item>

          <Form.Item
            name="role"
            label="分配岗位"
            rules={[{ required: true, message: "请选择岗位角色" }]}
          >
            <Select placeholder="请选择角色" options={roleOptions} />
          </Form.Item>

          {selectedRole === "doctor" && (
            <Form.Item
              name="department"
              label="所属科室"
              rules={[{ required: true, message: "请为医生分配科室" }]}
            >
              <Select placeholder="请选择科室" options={departmentOptions} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default Users;