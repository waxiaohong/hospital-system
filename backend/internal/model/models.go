package model

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User 用户表
type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Username  string         `gorm:"unique;not null" json:"username"`
	Password  string         `gorm:"not null" json:"-"`    // 不参与 JSON 序列化
	Role      string         `gorm:"not null" json:"role"` // global_admin, org_admin, finance, storekeeper, registration, general_user
	OrgID     uint           `json:"org_id"`               // 所属机构ID
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Medicine 药品表 (物资管理核心)
type Medicine struct {
	ID    uint    `gorm:"primaryKey" json:"id"`
	Name  string  `gorm:"not null" json:"name"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
	OrgID uint    `json:"org_id"`
}

// Patient 患者表
type Patient struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `json:"name"`
	Phone     string    `json:"phone"`
	IDCard    string    `json:"id_card"`
	CreatedAt time.Time `json:"created_at"`
}

// Booking 挂号记录
type Booking struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	PatientName string    `json:"patient_name"` // 新增：直接存名字
	Age         int       `json:"age"`          // 新增：年龄
	Gender      string    `json:"gender"`       // 新增：性别
	Department  string    `json:"department"`   // 新增：科室
	DoctorID    uint      `json:"doctor_id"`    // 关联医生
	Status      string    `json:"status"`       // Pending, Completed
	CreatedAt   time.Time `json:"created_at"`
}

// MedicalRecord 电子病历
type MedicalRecord struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	BookingID    uint      `json:"booking_id"`
	Diagnosis    string    `json:"diagnosis"`    // 诊断结果
	Prescription string    `json:"prescription"` // 处方内容 (简化为字符串)
	CreatedAt    time.Time `json:"created_at"`
}

// Order 缴费订单
type Order struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	BookingID   uint      `json:"booking_id"`
	TotalAmount float64   `json:"total_amount"`
	Status      string    `json:"status"`      // Unpaid, Paid
	MedicineID  uint      `json:"medicine_id"` // 简化：关联一个主要药品用于扣库存
	Quantity    int       `json:"quantity"`
	CreatedAt   time.Time `json:"created_at"`
}

// GeneratePassword 给密码加密
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// CheckPassword 验证密码
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}
