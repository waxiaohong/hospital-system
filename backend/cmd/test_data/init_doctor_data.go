package main

import (
	"hospital-system/internal/database"
	"hospital-system/internal/model"
	"log"
)

func main() {
	database.InitDB("./storage/db/hospital.db")

	// 1. 创建医生账号
	doctor := model.User{
		Username: "doc",         // 账号: doc
		Password: "password123", // 密码
		Role:     "doctor",      // 角色
		OrgID:    1,
	}
	if err := database.DB.Create(&doctor).Error; err != nil {
		log.Println("医生账号可能已存在，跳过创建")
	} else {
		log.Println("✅ 医生账号创建成功: doc / password123")
	}

	// 2. 创建一些药品 (有了药才能开处方)
	meds := []model.Medicine{
		{ID: 1, Name: "阿莫西林胶囊", Price: 25.5, Stock: 100, OrgID: 1},
		{ID: 2, Name: "布洛芬缓释胶囊", Price: 32.0, Stock: 50, OrgID: 1},
	}
	for _, m := range meds {
		if err := database.DB.Create(&m).Error; err != nil {
			log.Printf("药品 %s 可能已存在，跳过\n", m.Name)
		} else {
			log.Printf("✅ 药品 %s 入库成功\n", m.Name)
		}
	}
}
