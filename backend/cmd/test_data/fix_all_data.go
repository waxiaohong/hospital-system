package main

import (
	"hospital-system/internal/database"
	"hospital-system/internal/model"
	"log"
)

func main() {
	// 确保路径正确，强制使用和 main.go 一样的路径
	dbPath := "./storage/db/hospital.db"
	database.InitDB(dbPath)

	log.Println("🚀 开始修复/初始化所有数据...")

	// 1. 创建/修复 挂号员 (nurse)
	createOrUpdateUser("nurse", "registration")

	// 2. 创建/修复 医生 (doc)
	createOrUpdateUser("doc", "doctor")

	// 3. 创建/修复 财务 (money)
	createOrUpdateUser("money", "finance")

	// 4. 创建库房管理员
	createOrUpdateUser("store", "storekeeper")

	// 5. 补充药品
	createMeds()

	log.Println("✅ 所有数据修复完成！现在请重启后端并登录。")
}

func createOrUpdateUser(username, role string) {
	var user model.User
	// 查一下有没有
	if err := database.DB.Where("username = ?", username).First(&user).Error; err != nil {
		// 没有就创建
		newUser := model.User{
			Username: username,
			Password: "password123", // 统一密码
			Role:     role,
			OrgID:    1,
		}
		if err := database.DB.Create(&newUser).Error; err != nil {
			log.Printf("❌ 创建用户 %s 失败: %v\n", username, err)
		} else {
			log.Printf("✅ 成功创建用户: %s (角色: %s)\n", username, role)
		}
	} else {
		log.Printf("👌 用户 %s 已存在，跳过\n", username)
	}
}

func createMeds() {
	meds := []model.Medicine{
		{Name: "阿莫西林胶囊", Price: 25.5, Stock: 100, OrgID: 1},
		{Name: "布洛芬缓释胶囊", Price: 32.0, Stock: 50, OrgID: 1},
	}
	for _, m := range meds {
		var count int64
		database.DB.Model(&model.Medicine{}).Where("name = ?", m.Name).Count(&count)
		if count == 0 {
			database.DB.Create(&m)
			log.Printf("✅ 药品 %s 入库成功\n", m.Name)
		}
	}
}
