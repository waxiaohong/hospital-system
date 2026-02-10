package main

import (
	"hospital-system/internal/database"
	"hospital-system/internal/model"
	"log"
)

func main() {
	// 连接数据库
	database.InitDB("./storage/db/hospital.db")

	// 准备库管员账号
	storekeeper := model.User{
		Username: "store",
		Password: "password123",
		Role:     "storekeeper", // 关键权限
		OrgID:    1,
	}

	// 写入数据库
	if err := database.DB.Create(&storekeeper).Error; err != nil {
		log.Printf("❌ 创建失败 (可能账号已存在): %v", err)
	} else {
		log.Println("✅ 成功创建库管员账号！账号: store, 密码: password123")
	}
}
