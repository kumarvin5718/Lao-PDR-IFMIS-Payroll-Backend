package com.ifmis.payroll.controller;

import com.ifmis.payroll.dto.GradeDerivationUploadResponseDto;
import com.ifmis.payroll.service.GradeDerivationUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/grade-derivation")
@RequiredArgsConstructor
public class GradeDerivationUploadController {

    private final GradeDerivationUploadService gradeDerivationUploadService;

    @PostMapping("/upload")
    public ResponseEntity<GradeDerivationUploadResponseDto> uploadGradeDerivations(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        GradeDerivationUploadResponseDto response = gradeDerivationUploadService.uploadGradeDerivations(file);
        return ResponseEntity.ok(response);
    }
}
