package main

import (
	"hospital-system/internal/database"
	"hospital-system/internal/model"
	"log"
	"time"
)

func main() {
	// 1. 初始化数据库
	// 注意：如果你运行报错找不到数据库，请确保你在 backend 目录下运行
	database.InitDB("./storage/db/hospital.db")

	// 2. 造一张假订单
	order := model.Order{
		BookingID:   999,      // 假装有个挂号单
		TotalAmount: 158.50,   // 金额
		Status:      "Unpaid", // 关键：必须是未支付
		MedicineID:  1,        // 假装开了药
		Quantity:    2,
		CreatedAt:   time.Now(),
	}

	// 3. 写入数据库
	if err := database.DB.Create(&order).Error; err != nil {
		log.Fatalf("创建失败: %v", err)
	}

	log.Printf("✅ 成功插入测试订单！订单号: %d, 金额: %.2f", order.ID, order.TotalAmount)
}
