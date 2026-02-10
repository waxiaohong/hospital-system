package api

import (
	"hospital-system/internal/api/middleware"
	"hospital-system/internal/database"
	"hospital-system/internal/model"
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
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role" binding:"required"` // registrar, doctor, cashier
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

	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密码错误"})
		return
	}

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
	var user model.User
	// 1. 直接绑定，减少手动赋值
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}

	// 2. 安全防线：不论前端传什么 role，这里强制改为普通用户
	user.Role = "general_user"

	// 3. 初始机构逻辑
	if user.OrgID == 0 {
		user.OrgID = 1 // 默认主院区
	}

	// 4. 执行写入
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

// GetBookings 获取挂号列表（按时间倒序）
func GetBookings(c *gin.Context) {
	var bookings []model.Booking
	// Order("created_at desc") 让最新的挂号显示在最上面
	database.DB.Order("created_at desc").Find(&bookings)
	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

// CreateBooking 挂号员：新增挂号
func CreateBooking(c *gin.Context) {
	var req BookingRequest
	// 1. 绑定前端发来的 JSON 数据
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误: " + err.Error()})
		return
	}

	// 2. 直接构建 Booking 对象 (MVP模式：不查 Patient 表，直接存)
	booking := model.Booking{
		PatientName: req.PatientName,
		Age:         req.Age,
		Gender:      req.Gender,
		Department:  req.Department,
		DoctorID:    req.DoctorID,
		Status:      "Pending", // 默认状态：候诊中
		CreatedAt:   time.Now(),
	}

	// 简单的兜底逻辑：如果前端没传医生ID，默认分配给 1 号医生
	if booking.DoctorID == 0 {
		booking.DoctorID = 1
	}

	// 3. 写入数据库
	if err := database.DB.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "挂号失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "挂号成功", "data": booking})
}

// --- 财务业务 (Finance/Payment) ---
// 对应页面：/payment

func GetUnpaidOrders(c *gin.Context) {
	var orders []model.Order
	// 查找所有状态为 Unpaid 的订单
	database.DB.Where("status = ?", "Unpaid").Find(&orders)
	c.JSON(http.StatusOK, gin.H{"data": orders})
}

// GetPaidOrders 获取所有已支付的订单历史
func GetPaidOrders(c *gin.Context) {
	var orders []model.Order
	// 查询 status 为 "Paid" 的记录，并按时间倒序排列（最新的在最上面）
	if err := database.DB.Where("status = ?", "Paid").Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取历史记录"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"orders": orders})
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
	var bookings []model.Booking
	// 修正1：状态改成 "Pending" (大写P)，对应 CreateBooking
	// 修正2：加了 Order("created_at asc")，先挂号的排前面
	database.DB.Where("status = ?", "Pending").Order("created_at asc").Find(&bookings)
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

// GetRecords 获取所有电子病历档案
func GetRecords(c *gin.Context) {
	var records []model.MedicalRecord

	// Preload("Booking") 会自动填充 Booking 字段，这样我们就能拿到病人名字了
	// 前提是 model.MedicalRecord 里定义了 Booking 关联，或者我们手动查
	// 这里为了简单稳妥，我们用更直接的“连表查询”思路，或者先查出来再组装
	// 但最最简单的方式是：直接查出来，前端展示简单的 Presciption 即可
	// 为了更完美，我们稍微改一下查询逻辑：

	// 1. 查询所有病历，按时间倒序
	if err := database.DB.Order("created_at desc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取病历失败"})
		return
	}

	// 2. 这里的 records 里只有 BookingID，没有病人名字。
	// 为了让前端显示名字，我们需要手动补全，或者前端再发请求。
	// 鉴于你是全栈，我们用一种“笨办法”但绝对不出错：
	// 我们定义一个返回给前端的结构体
	type RecordResponse struct {
		ID           uint      `json:"id"`
		PatientName  string    `json:"patient_name"`
		Diagnosis    string    `json:"diagnosis"`
		Prescription string    `json:"prescription"`
		CreatedAt    time.Time `json:"created_at"`
		DoctorName   string    `json:"doctor_name"` // 也可以加上医生名字
	}

	var response []RecordResponse

	for _, r := range records {
		var booking model.Booking
		// 根据 BookingID 查挂号单，拿到病人名字
		database.DB.First(&booking, r.BookingID)

		response = append(response, RecordResponse{
			ID:           r.ID,
			PatientName:  booking.PatientName, // 核心：拿到名字
			Diagnosis:    r.Diagnosis,
			Prescription: r.Prescription,
			CreatedAt:    r.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}

// --- 用户管理 (Users) ---
// 对应页面：/users

func ManageUserStatus(c *gin.Context) {
	// 简单实现：列出所有用户
	var users []model.User
	database.DB.Omit("password").Find(&users)
	c.JSON(http.StatusOK, gin.H{"data": users})
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
