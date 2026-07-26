package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Response.AdminOverviewDto;
import com.study.kakeibo.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 「管理」ビュー: 裏で自動管理しているデータの読み取り専用エンドポイント。
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    /** アプリが自動管理しているデータの概況を返す。 GET /admin/overview */
    @GetMapping("/overview")
    public ResponseEntity<AdminOverviewDto> overview(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(adminService.overview(userId));
    }
}
