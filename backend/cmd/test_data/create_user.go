package main

import (
	"hospital-system/internal/database"
	"hospital-system/internal/model"
	"log"
)

func main() {
	// 1. 初始化数据库连接
	database.InitDB("./storage/db/hospital.db")

	// 2. 创建一个“挂号员”账号
	receptionist := model.User{
		Username: "nurse",        // 账号名：nurse (护士/前台)
		Password: "password123",  // 密码
		Role:     "registration", // 🔥 关键：赋予挂号员权限
		OrgID:    1,
	}

	// 3. 写入数据库 (GORM 的 Hooks 会自动加密密码)
	if err := database.DB.Create(&receptionist).Error; err != nil {
		log.Printf("❌ 创建失败 (可能账号已存在): %v", err)
	} else {
		log.Printf("✅ 成功创建挂号员账号！账号: nurse, 密码: password123")
	}
}
