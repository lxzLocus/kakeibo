package com.study.kakeibo.controller;

import com.study.kakeibo.dto.Request.ImportRequestDto;
import com.study.kakeibo.dto.Response.ImportResultDto;
import com.study.kakeibo.service.ImportService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/import")
public class ImportController {

    @Autowired
    private ImportService importService;

    /**
     * CSV または Markdown テキストからエントリを一括インポートする。
     *
     * POST /import
     * Headers: X-User-Id: 1
     * Body: { "format": "csv", "content": "日付,店舗,カテゴリ,金額,メモ\n..." }
     */
    @PostMapping
    public ResponseEntity<ImportResultDto> importData(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody ImportRequestDto request
    ) {
        ImportResultDto result = importService.importData(
                userId,
                request.getFormat(),
                request.getContent()
        );
        return ResponseEntity.ok(result);
    }
}
