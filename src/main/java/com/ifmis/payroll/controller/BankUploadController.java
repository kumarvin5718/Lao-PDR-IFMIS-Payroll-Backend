package com.ifmis.payroll.controller;

import com.ifmis.payroll.dto.BankUploadResponseDto;
import com.ifmis.payroll.service.BankUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/banks")
@RequiredArgsConstructor
public class BankUploadController {

    private final BankUploadService bankUploadService;

    @PostMapping("/upload")
    public ResponseEntity<BankUploadResponseDto> uploadBanks(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        BankUploadResponseDto response = bankUploadService.uploadBanks(file);
        return ResponseEntity.ok(response);
    }
}
