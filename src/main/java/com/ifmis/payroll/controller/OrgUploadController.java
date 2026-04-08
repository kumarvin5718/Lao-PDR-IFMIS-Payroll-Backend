package com.ifmis.payroll.controller;

import com.ifmis.payroll.dto.OrgUploadResponseDto;
import com.ifmis.payroll.service.OrgUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/org")
@RequiredArgsConstructor
public class OrgUploadController {

    private final OrgUploadService orgUploadService;

    @PostMapping("/upload")
    public ResponseEntity<OrgUploadResponseDto> uploadOrganizations(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        OrgUploadResponseDto response = orgUploadService.uploadOrganizations(file);
        return ResponseEntity.ok(response);
    }
}
