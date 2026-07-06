package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Response.ReceiptDraftDto;
import com.study.kakeibo.service.ReceiptOcrService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/receipts")
public class ReceiptController {

    private final ReceiptOcrService receiptOcrService;

    public ReceiptController(ReceiptOcrService receiptOcrService) {
        this.receiptOcrService = receiptOcrService;
    }

    /**
     * レシート画像をアップロードしてOCR抽出する。結果はドラフトとして返し、永続化はしない。
     */
    @PostMapping(value = "/scan", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReceiptDraftDto> scan(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(receiptOcrService.scan(userId, file));
    }
}
