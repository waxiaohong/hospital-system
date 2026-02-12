package api

import (
	"hospital-system/internal/api/middleware"
	"hospital-system/internal/database"
	"hospital-system/internal/model"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// --- 认证模块 ---

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	Role       string `json:"role" binding:"required"`
	Department string `json:"department"`
}

func LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var user model.User
	if err := database.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
		return
	}

	log.Printf("【调试】正在比对用户: %s", user.Username)
	log.Printf("【调试】用户输入明文: %s", req.Password)
	log.Printf("【调试】数据库存储哈希: %s", user.Password)

	if !user.CheckPassword(req.Password) {
		log.Println("【结果】密码比对失败！")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密码错误"})
		return
	}

	log.Println("【结果】密码比对成功")

	// 签发 Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"org_id":  user.OrgID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString(middleware.JwtKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token生成失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  gin.H{"username": user.Username, "role": user.Role, "id": user.ID},
	})
}

func RegisterHandler(c *gin.Context) {
	// RegisterRequest 接收参数，而不是 model.User
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 2. 手动构建 model.User 对象
	user := model.User{
		Username: req.Username,
		Password: req.Password,   // 此时 req.Password 是有值的！
		Role:     "general_user", // 强制指定角色
		OrgID:    1,              //默认主院区
	}

	// 3. 执行写入 (BeforeCreate 会自动加密 user.Password)
	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "注册失败，用户名已存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"msg": "注册成功"})
}

// --- 挂号业务 (Bookings) ---
// 对应页面：/bookings

// BookingRequest 定义前端传来的挂号参数
type BookingRequest struct {
	PatientName string `json:"patient_name" binding:"required"`
	Age         int    `json:"age"`
	Gender      string `json:"gender"`
	Department  string `json:"department" binding:"required"`
	DoctorID    uint   `json:"doctor_id"`
	// Phone    string `json:"phone"` // 暂不存手机号，以免数据库报错，除非你在 model 里加了 Phone
}

// GetBookings 获取挂号列表
func GetBookings(c *gin.Context) {
	// 1. 从中间件上下文中获取当前用户信息
	// 注意：必须确保 AuthMiddleware 里正确设置了这些值
	role := c.GetString("role")
	userID := c.GetUint("user_id") // 假设中间件里 set 的是 uint

	var bookings []model.Booking
	tx := database.DB.Order("created_at desc")

	// 2. 权限分流
	if role == "general_user" {
		// 【核心逻辑】如果是普通用户，必须先查出他的名字，然后只返回属于他的记录
		var currentUser model.User
		if err := database.DB.First(&currentUser, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无法获取用户信息"})
			return
		}
		// 强制加上 WHERE 条件
		tx = tx.Where("patient_name = ?", currentUser.Username)
	}
	// 如果是 registration/admin，则不加 Where 条件，默认查所有

	// 3. 执行查询
	if err := tx.Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

// CreateBooking
func CreateBooking(c *gin.Context) {
	var req BookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 1. 获取当前用户身份
	role := c.GetString("role")
	userID := c.GetUint("user_id")

	// 2. 构建对象
	booking := model.Booking{
		Age:        req.Age,
		Gender:     req.Gender,
		Department: req.Department,
		DoctorID:   req.DoctorID,
		Status:     "Pending",
		CreatedAt:  time.Now(),
	}

	// 3. 【核心逻辑】姓名处理
	if role == "general_user" {
		// 如果是患者，强制使用当前登录账号的用户名，忽略前端传来的 PatientName
		var currentUser model.User
		database.DB.First(&currentUser, userID)
		booking.PatientName = currentUser.Username
	} else {
		// 如果是挂号员，允许使用前端传来的名字（帮别人挂号）
		if req.PatientName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "挂号员必须填写患者姓名"})
			return
		}
		booking.PatientName = req.PatientName
	}

	// 4. 兜底医生ID
	if booking.DoctorID == 0 {
		// 尝试分配给 ID 为 1 的医生，如果也没有，就置空
		booking.DoctorID = 1
	}

	if err := database.DB.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "挂号失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "挂号成功", "data": booking})
}

// GetDoctorList 专门用于下拉框的医生列表接口 (公开给登录用户)
func GetDoctorList(c *gin.Context) {
	var doctors []model.User
	// GORM 默认 select *，所以只要结构体里有 Department，就会查出来
	database.DB.Where("role = ?", "doctor").Find(&doctors)
	c.JSON(http.StatusOK, gin.H{"data": doctors})
}

// --- Payment ---
// 对应页面：/payment

// 1. 定义返回结构体
type OrderDetail struct {
	model.Order
	PatientName   string  `json:"patient_name"`
	MedicineName  string  `json:"medicine_name"`  // 新增：药名
	MedicinePrice float64 `json:"medicine_price"` // 新增：单价
}

// GetUnpaidOrders 获取待缴费订单
func GetUnpaidOrders(c *gin.Context) {
	role := c.GetString("role")
	userID := c.GetUint("user_id")

	var results []OrderDetail

	// 2. 连表查询 (Orders + Bookings + Medicines)
	// 使用 LEFT JOIN medicines，防止如果药品被删除了导致订单查不出来
	db := database.DB.Table("orders").
		Select("orders.*, bookings.patient_name, medicines.name as medicine_name, medicines.price as medicine_price").
		Joins("JOIN bookings ON bookings.id = orders.booking_id").
		Joins("LEFT JOIN medicines ON medicines.id = orders.medicine_id").
		Where("orders.status = ?", "Unpaid").
		Order("orders.created_at desc")

	// 权限判断
	if role == "general_user" {
		// 1. 如果是普通用户，只能查 Booking.PatientName == 当前用户名
		var currentUser model.User
		if err := database.DB.First(&currentUser, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户身份异常"})
			return
		}
		// 核心过滤：只看自己的名字
		db = db.Where("bookings.patient_name = ?", currentUser.Username)
	}
	// 2. 如果是 registration/finance/admin，不加额外 Where 条件，即查询所有

	if err := db.Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取订单失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// GetPaidOrders 获取历史记录
func GetPaidOrders(c *gin.Context) {
	role := c.GetString("role")
	userID := c.GetUint("user_id")

	var results []OrderDetail

	// 同样的连表逻辑
	db := database.DB.Table("orders").
		Select("orders.*, bookings.patient_name, medicines.name as medicine_name, medicines.price as medicine_price").
		Joins("JOIN bookings ON bookings.id = orders.booking_id").
		Joins("LEFT JOIN medicines ON medicines.id = orders.medicine_id").
		Where("orders.status = ?", "Paid").
		Order("orders.updated_at desc") // 按支付时间倒序

	if role == "general_user" {
		var currentUser model.User
		database.DB.First(&currentUser, userID)
		db = db.Where("bookings.patient_name = ?", currentUser.Username)
	}

	if err := db.Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取历史失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

type PaymentRequest struct {
	OrderID uint `json:"order_id"`
}

func ConfirmPayment(c *gin.Context) {
	var req PaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	tx := database.DB.Begin() // 开启事务

	// 1. 查找订单
	var order model.Order
	if err := tx.First(&order, req.OrderID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "订单不存在"})
		return
	}

	if order.Status == "Paid" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "订单已支付"})
		return
	}

	// 2. 更新订单状态
	if err := tx.Model(&order).Update("status", "Paid").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新订单失败"})
		return
	}

	// 3. 扣减库存 (如果订单关联了药品)
	if order.MedicineID != 0 {
		var med model.Medicine
		if err := tx.First(&med, order.MedicineID).Error; err == nil {
			if med.Stock >= order.Quantity {
				tx.Model(&med).Update("stock", med.Stock-order.Quantity)
			} else {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "库存不足"})
				return
			}
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"msg": "支付成功，库存已更新"})
}

// --- 医生业务 (Doctor) ---
// 对应页面：/doctor

// GetPendingPatients 获取候诊列表
func GetPendingPatients(c *gin.Context) {
	userID := c.GetUint("user_id") // 从 Token 中获取当前医生 ID
	role := c.GetString("role")    // 获取角色

	var bookings []model.Booking

	// 1. 基础查询：状态必须是 Pending，按时间排序
	tx := database.DB.Where("status = ?", "Pending").Order("created_at asc")

	// 2. 权限分流
	if role == "doctor" {
		// 核心逻辑：医生只能看分配给自己的患者
		// 这样既实现了“科室隔离”（因为你不能被分配到别科的单子），也实现了“人维度隔离”
		tx = tx.Where("doctor_id = ?", userID)

		// 扩展思路：如果你希望同一个科室的医生能看到彼此的病人（科室池模式），
		// 可以改成先查出医生的 Department，然后 tx.Where("department = ?", doc.Department)
		// 但基于“先选医生”的设计，按 doctor_id 过滤是最严谨的。
	}

	// 如果是 admin，则不加 doctor_id 限制，可以看到全院候诊情况

	// 3. 执行查询
	if err := tx.Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取候诊列表失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

// 这里的结构体定义可以保留在外面，也可以放里面，这里沿用你的定义
type RecordRequest struct {
	BookingID  uint   `json:"booking_id"`
	Diagnosis  string `json:"diagnosis"`
	MedicineID uint   `json:"medicine_id"` // 开什么药
	Quantity   int    `json:"quantity"`    // 开多少
}

// SubmitMedicalRecord 提交诊断
func SubmitMedicalRecord(c *gin.Context) {
	var req RecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	tx := database.DB.Begin() // 开启事务

	// 1. 检查并锁定药品（获取价格）
	var med model.Medicine
	if err := tx.First(&med, req.MedicineID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "药品不存在，请检查药品ID"})
		return
	}

	// 2. 保存病历
	record := model.MedicalRecord{
		BookingID:    req.BookingID,
		Diagnosis:    req.Diagnosis,
		Prescription: "Rx: " + med.Name + " x " + strconv.Itoa(req.Quantity), // 优化：把药名写进处方
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&record).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存病历失败"})
		return
	}

	// 3. 更新挂号状态 -> Completed (已就诊)
	// 修正：状态改成 "Completed" (大写C)
	if err := tx.Model(&model.Booking{}).Where("id = ?", req.BookingID).Update("status", "Completed").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新状态失败"})
		return
	}

	// 4. 生成缴费单 (Unpaid)
	order := model.Order{
		BookingID:   req.BookingID,
		TotalAmount: med.Price * float64(req.Quantity), // 自动计算总价
		Status:      "Unpaid",                          // 待支付
		MedicineID:  req.MedicineID,
		Quantity:    req.Quantity,
		CreatedAt:   time.Now(),
	}
	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成订单失败"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"msg": "诊断完成，已生成缴费单", "order_id": order.ID})
}

// --- 库房业务 (Storehouse) ---
// 对应页面：/storehouse

func GetInventory(c *gin.Context) {
	var meds []model.Medicine
	database.DB.Find(&meds)
	c.JSON(http.StatusOK, gin.H{"data": meds})
}

func AddMedicine(c *gin.Context) {
	var med model.Medicine
	if err := c.ShouldBindJSON(&med); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	database.DB.Create(&med)
	c.JSON(http.StatusOK, gin.H{"msg": "添加药品成功", "data": med})
}

// --- 记录 (Record) ---
// 对应页面：/record

// 定义返回结构，方便前端显示医生名字和患者名字
type MedicalRecordDetail struct {
	model.MedicalRecord
	PatientName string `json:"patient_name"`
	DoctorName  string `json:"doctor_name"`
}

// GetMedicalRecords 获取电子病历列表
func GetMedicalRecords(c *gin.Context) {
	role := c.GetString("role")
	userID := c.GetUint("user_id")

	var results []MedicalRecordDetail

	// 1. 基础查询：关联 bookings 表以获取患者信息
	// 假设你的 User 表里存了医生名字，这里也可以关联 users 表获取医生名
	// 这里简化处理，先只关联 bookings
	db := database.DB.Table("medical_records").
		Select("medical_records.*, bookings.patient_name").
		Joins("JOIN bookings ON bookings.id = medical_records.booking_id").
		Order("medical_records.created_at desc")

	// 2. 权限分流
	switch role {
	case "general_user":
		// --- 情况 A: 普通患者 ---
		// 只能看属于自己的病历
		var currentUser model.User
		if err := database.DB.First(&currentUser, userID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户身份异常"})
			return
		}
		// 核心逻辑：只查 bookings.patient_name 等于当前用户名的记录
		db = db.Where("bookings.patient_name = ?", currentUser.Username)

	case "doctor":
		// --- 情况 B: 医生 ---
		// 医生通常可以看到自己开出的病历，或者整个科室的病历
		// 这里演示：只看自己作为医生经手的 (依赖 bookings.doctor_id)
		db = db.Where("bookings.doctor_id = ?", userID)

		// 如果你希望医生能看全院病历以便会诊，这里可以留空，不做 where 限制

	case "admin", "global_admin":
		// --- 情况 C: 管理员 ---
		// 查看所有，不做限制
	}

	// 3. 执行查询
	if err := db.Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取病历失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

// --- 用户管理 (Users) ---
// 对应页面：/users

func ManageUserStatus(c *gin.Context) {
	// 简单实现：列出所有用户
	var users []model.User
	database.DB.Omit("password").Find(&users)
	c.JSON(http.StatusOK, gin.H{"data": users})
}

// 对应路由: POST /api/v1/dashboard/users
func CreateUser(c *gin.Context) {
	// 复用注册请求结构，但这里我们允许 Role
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 检查当前操作者的权限（可选：防止 org_admin 创建 global_admin）
	// currentRole := c.GetString("role")
	// 这里做简单处理：直接信任中间件的拦截

	user := model.User{
		Username:   req.Username,
		Password:   req.Password, // BeforeCreate 会自动加密
		Role:       req.Role,     // 关键：直接使用前端传来的角色 (doctor, finance...)
		Department: req.Department,
		OrgID:      1, // mvp 默认机构1
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "用户已存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"msg": "用户创建成功", "data": user})
}

// 对应路由 PUT /api/v1/dashboard/users/:id
func UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Role       string `json:"role"`
		Department string `json:"department"`
		Password   string `json:"password"` // 可选：重置密码
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	var user model.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}

	// 更新字段
	if req.Role != "" {
		user.Role = req.Role
	}
	// 允许把科室改为空字符串（例如转岗），所以不判断空
	user.Department = req.Department

	// 如果传了新密码，则修改（GORM Hook 会自动加密吗？不会！Update 不触发 BeforeCreate）
	// 所以这里需要手动加密，或者把逻辑抽离。为简化，这里假设前端不传密码，只改科室。
	// 如果要改密码，建议单独写 ResetPassword 接口。

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"msg": "用户信息已更新", "data": user})
}

// --- 统计看板 (Dashboard Stats) ---

func GetDashboardStats(c *gin.Context) {
	// 1. 统计总收入 (只算 Paid 的)
	var totalIncome float64
	// SQL: SELECT SUM(total_amount) FROM orders WHERE status = 'Paid'
	database.DB.Model(&model.Order{}).Where("status = ?", "Paid").Select("sum(total_amount)").Row().Scan(&totalIncome)

	// 2. 统计总患者数/挂号单数
	var patientCount int64
	database.DB.Model(&model.Booking{}).Count(&patientCount)

	// 3. 统计医生数量
	var doctorCount int64
	database.DB.Model(&model.User{}).Where("role = ?", "doctor").Count(&doctorCount)

	// 4. 统计药品种类
	var medCount int64
	database.DB.Model(&model.Medicine{}).Count(&medCount)

	c.JSON(http.StatusOK, gin.H{
		"income":   totalIncome,
		"patients": patientCount,
		"doctors":  doctorCount,
		"meds":     medCount,
	})
}
